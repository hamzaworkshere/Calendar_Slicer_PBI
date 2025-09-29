import powerbi from "powerbi-visuals-api";
import "../style/visual.less";

import IVisual = powerbi.extensibility.visual.IVisual;
import VisualConstructorOptions = powerbi.extensibility.visual.VisualConstructorOptions;
import VisualUpdateOptions = powerbi.extensibility.visual.VisualUpdateOptions;
import IVisualHost = powerbi.extensibility.visual.IVisualHost;
import DataView = powerbi.DataView;
import ISelectionId = powerbi.extensibility.ISelectionId;

type ViewMode = 'day' | 'month' | 'year';

interface CalendarSettings {
  startOfWeek: 'Sunday' | 'Monday';
  showWeekNumbers: boolean;
  otherMonthFade: boolean;
  showDOWHeader: boolean; // Show day-of-week header row (Mon/Tue/...)
}

interface HeaderSettings {
  accentColor: string;
  textColor: string;
  headerBackground: string;
  fontSize: number;
  showHeader: boolean;
  title?: string;
  showClear: boolean;
}

interface ItemSettings {
  fontSize: number;
  color?: string;
  selectedColor?: string;
  boldSelected: boolean;
}

interface SelectionSettings {
  multiSelect: boolean;
  rangeSelect: boolean;
  stickySelection: boolean;
}

interface DateRangeSettings {
  respectDataRange: boolean;
  minDate?: string;
  maxDate?: string;
}

export class Visual implements IVisual {
  private host: IVisualHost;

  private headerEl: HTMLElement;
  private gridEl: HTMLElement;
  private footerEl: HTMLElement;

  private viewMode: ViewMode = 'day';
  private cursorYear: number = new Date().getFullYear();
  private cursorMonth: number = new Date().getMonth();

  private selectedKeys: Set<number> = new Set();
  private lastClickedKey: number | null = null;

  private settings: CalendarSettings = {
    startOfWeek: 'Monday',
    showWeekNumbers: false,
    otherMonthFade: true,
    showDOWHeader: false, // default OFF to avoid confusion with day names
  };

  private header: HeaderSettings = {
    accentColor: '#3366cc',
    textColor: '#1f1f1f',
    headerBackground: '#f4f6fb',
    fontSize: 12,
    showHeader: true,
    title: undefined,
    showClear: true,
  };

  private items: ItemSettings = {
    fontSize: 12,
    color: undefined,
    selectedColor: undefined,
    boldSelected: false,
  };

  private selectionSettings: SelectionSettings = {
    multiSelect: true,
    rangeSelect: true,
    stickySelection: true,
  };

  private dateRange: DateRangeSettings = { respectDataRange: true };

  private identitiesByKey: Map<number, ISelectionId> = new Map();
  private selectableKeys: Set<number> = new Set();
  private minDataKey: number | null = null;
  private maxDataKey: number | null = null;

  private filterTarget: { table: string; column: string } | null = null;

  constructor(options: VisualConstructorOptions) {
    this.host = options.host;

    const root = document.createElement('div');
    root.className = 'calendar-slicer';

    this.headerEl = document.createElement('div');
    this.headerEl.className = 'calendar-header';

    this.gridEl = document.createElement('div');
    this.gridEl.className = 'calendar-grid';

    this.footerEl = document.createElement('div');
    this.footerEl.className = 'footer';

    root.appendChild(this.headerEl);
    root.appendChild(this.gridEl);
    root.appendChild(this.footerEl);
    options.element.appendChild(root);

    // Clear selection when clicking outside (if stickySelection = false)
    root.addEventListener('click', (e) => {
      if (!this.selectionSettings.stickySelection && e.target === root) this.clearSelection();
    });
  }

  public update(options: VisualUpdateOptions) {
    const dv = options.dataViews && options.dataViews[0];
    this.readSettings(dv);
    this.loadData(dv);
    this.applyTheme();
    this.render();
  }

  // -----------------------------
  // Settings / Data
  // -----------------------------

  private readSettings(dv?: DataView) {
    const objects: any = dv?.metadata?.objects ?? {} as any;
    const cal = (objects['calendarSettings'] ?? {}) as any;
    const hdr = (objects['headerSettings'] ?? {}) as any;
    const sel = (objects['selectionSettings'] ?? {}) as any;
    const rng = (objects['dateRange'] ?? {}) as any;
    const itm = (objects['itemSettings'] ?? {}) as any;

    this.settings.startOfWeek = (cal.startOfWeek as ('Sunday'|'Monday')) ?? this.settings.startOfWeek;
    this.settings.showWeekNumbers = (cal.showWeekNumbers !== undefined) ? !!cal.showWeekNumbers : this.settings.showWeekNumbers;
    this.settings.otherMonthFade = (cal.otherMonthFade !== undefined) ? !!cal.otherMonthFade : this.settings.otherMonthFade;
    this.settings.showDOWHeader = (cal.showDOWHeader !== undefined) ? !!cal.showDOWHeader : this.settings.showDOWHeader;

    this.header.accentColor = hdr.accentColor?.solid?.color ?? this.header.accentColor;
    this.header.textColor = hdr.textColor?.solid?.color ?? this.header.textColor;
    this.header.headerBackground = hdr.headerBackground?.solid?.color ?? this.header.headerBackground;
    this.header.fontSize = (typeof hdr.fontSize === 'number') ? hdr.fontSize : this.header.fontSize;
    this.header.showHeader = (hdr.showHeader !== undefined) ? !!hdr.showHeader : this.header.showHeader;
    this.header.title = (typeof hdr.title === 'string') ? hdr.title : this.header.title;
    this.header.showClear = (hdr.showClear !== undefined) ? !!hdr.showClear : this.header.showClear;

    this.items.fontSize = (typeof itm.fontSize === 'number') ? itm.fontSize : this.items.fontSize;
    this.items.color = itm.color?.solid?.color ?? this.items.color;
    this.items.selectedColor = itm.selectedColor?.solid?.color ?? this.items.selectedColor;
    this.items.boldSelected = (itm.boldSelected !== undefined) ? !!itm.boldSelected : this.items.boldSelected;

    this.selectionSettings.multiSelect = (sel.multiSelect !== undefined) ? !!sel.multiSelect : this.selectionSettings.multiSelect;
    this.selectionSettings.rangeSelect = (sel.rangeSelect !== undefined) ? !!sel.rangeSelect : this.selectionSettings.rangeSelect;
    this.selectionSettings.stickySelection = (sel.stickySelection !== undefined) ? !!sel.stickySelection : this.selectionSettings.stickySelection;

    this.dateRange.respectDataRange = (rng.respectDataRange !== undefined) ? !!rng.respectDataRange : this.dateRange.respectDataRange;
    this.dateRange.minDate = (typeof rng.minDate === 'string') ? rng.minDate : this.dateRange.minDate;
    this.dateRange.maxDate = (typeof rng.maxDate === 'string') ? rng.maxDate : this.dateRange.maxDate;
  }

  private parseISODate(s?: string): Date | null {
    if (!s) return null;
    const m = /^\s*(\d{4})\-(\d{2})\-(\d{2})\s*$/.exec(s);
    if (!m) return null;
    const d = new Date(Date.UTC(parseInt(m[1],10), parseInt(m[2],10)-1, parseInt(m[3],10)));
    return isNaN(d.getTime()) ? null : d;
  }

  private atUTC(date: Date): number {
    return Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate());
  }

  private loadData(dv?: DataView) {
    this.identitiesByKey.clear();
    this.selectableKeys.clear();
    this.minDataKey = null;
    this.maxDataKey = null;
    this.filterTarget = null;

    if (!dv?.categorical?.categories?.length) {
      const today = new Date();
      this.cursorYear = today.getFullYear();
      this.cursorMonth = today.getMonth();
      return;
    }

    const cat = dv.categorical.categories[0];

    // Derive filter target table/column from queryName
    const qn = (cat?.source as any)?.queryName;
    if (typeof qn === 'string') {
      const dot = qn.lastIndexOf('.');
      if (dot > 0) this.filterTarget = { table: qn.substring(0, dot), column: qn.substring(dot+1) };
    }

    const values = (cat.values as any[]) ?? [];
    for (let i=0; i<values.length; i++) {
      const v = values[i];
      if (v==null) continue;

      let d: Date | null = null;
      if (v instanceof Date) {
        d = new Date(Date.UTC(v.getUTCFullYear(), v.getUTCMonth(), v.getUTCDate()));
      } else {
        const tryISO = this.parseISODate(String(v));
        if (tryISO) d = tryISO;
        else {
          const t = new Date(v as any);
          if (!isNaN(t.getTime())) d = new Date(Date.UTC(t.getUTCFullYear(), t.getUTCMonth(), t.getUTCDate()));
        }
      }
      if (!d) continue;

      const key = Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate());
      const selId = this.host.createSelectionIdBuilder().withCategory(cat, i).createSelectionId();

      this.identitiesByKey.set(key, selId);
      this.selectableKeys.add(key);

      if (this.minDataKey===null || key < this.minDataKey) this.minDataKey = key;
      if (this.maxDataKey===null || key > this.maxDataKey) this.maxDataKey = key;
    }
  }

  private applyTheme() {
    const root = (this.headerEl.parentElement as HTMLElement);
    root.style.setProperty('--accent', this.header.accentColor);
    root.style.setProperty('--text', this.header.textColor);
    root.style.setProperty('--header-bg', this.header.headerBackground);
    root.classList.toggle('no-fade-other-month', !this.settings.otherMonthFade);
  }

  // -----------------------------
  // Rendering
  // -----------------------------

  private render() {
    // Header
    this.headerEl.style.display = this.header.showHeader ? 'flex' : 'none';
    if (this.header.showHeader) this.renderHeader();

    // Grid
    this.gridEl.innerHTML = '';
    if (this.viewMode==='day') this.renderDayGrid();
    else if (this.viewMode==='month') this.renderMonthGrid();
    else this.renderYearGrid();

    // Footer
    this.renderFooter();
  }

  private renderHeader() {
    this.headerEl.innerHTML = '';

    const left = document.createElement('div');
    left.className='nav';

    const prevBtn = document.createElement('button');
    prevBtn.title='Previous';
    prevBtn.textContent='<';
    prevBtn.onclick=()=>{
      if(this.viewMode==='day') this.shiftMonth(-1);
      else if(this.viewMode==='month') this.shiftYear(-1);
      else this.shiftYear(-12);
    };

    const nextBtn = document.createElement('button');
    nextBtn.title='Next';
    nextBtn.textContent='>';
    nextBtn.onclick=()=>{
      if(this.viewMode==='day') this.shiftMonth(1);
      else if(this.viewMode==='month') this.shiftYear(1);
      else this.shiftYear(12);
    };

    left.appendChild(prevBtn);
    left.appendChild(nextBtn);

    const title = document.createElement('div');
    title.className='title';
    title.style.cursor='pointer';
    title.style.fontSize=(this.header.fontSize+2)+'px';

    if (this.header?.title && this.header.title.trim().length>0) {
      title.textContent = this.header.title;
    } else {
      if (this.viewMode==='day') title.textContent = `${this.monthName(this.cursorMonth)} ${this.cursorYear}`;
      else if (this.viewMode==='month') title.textContent = `${this.cursorYear}`;
      else title.textContent = `${Math.floor(this.cursorYear/12)*12} – ${Math.floor(this.cursorYear/12)*12+11}`;
    }

    title.onclick = ()=>{
      if(this.viewMode==='day') this.viewMode='month';
      else if(this.viewMode==='month') this.viewMode='year';
      else this.viewMode='day';
      this.render();
    };

    const right = document.createElement('div');
    right.className='nav';

    const modeBtn = document.createElement('button');
    modeBtn.textContent=this.viewMode.toUpperCase();
    modeBtn.title='Change view';
    modeBtn.onclick=()=>{
      this.viewMode = this.viewMode==='day' ? 'month' : this.viewMode==='month' ? 'year' : 'day';
      this.render();
    };
    right.appendChild(modeBtn);

    if (this.header.showClear) {
      const clearBtn = document.createElement('button');
      clearBtn.textContent='Clear';
      clearBtn.onclick=()=> this.clearSelection();
      right.appendChild(clearBtn);
    }

    this.headerEl.appendChild(left);
    this.headerEl.appendChild(title);
    this.headerEl.appendChild(right);
  }

  private renderFooter() {
    const total = this.selectedKeys.size;
    const label = total===0 ? 'No dates selected' : `${total} date${total>1?'s':''} selected`;
    this.footerEl.innerHTML = `<div>${label}</div><div>Tip: Ctrl/Cmd for multi, Shift for range</div>`;
  }

  private monthName(m:number){ return ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'][m]; }
  private shiftMonth(delta:number){ let m=this.cursorMonth+delta,y=this.cursorYear; while(m<0){m+=12;y-=1;} while(m>11){m-=12;y+=1;} this.cursorMonth=m; this.cursorYear=y; this.render(); }
  private shiftYear(delta:number){ this.cursorYear += delta; this.render(); }

  private getStartOfWeekOffset(dow0Sunday:number){
    if(this.settings.startOfWeek==='Monday'){ return dow0Sunday===0?6:dow0Sunday-1; }
    return dow0Sunday;
  }

  private getISOWeek(d: Date): number {
    const date = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()));
    const day = (date.getUTCDay()||7);
    date.setUTCDate(date.getUTCDate() + 4 - day);
    const yearStart = new Date(Date.UTC(date.getUTCFullYear(),0,1));
    const diffDays = Math.floor((date.getTime()-yearStart.getTime())/86400000)+1;
    return Math.ceil(diffDays/7);
  }

  private renderDayGrid(){
    const y=this.cursorYear, m=this.cursorMonth;
    const first=new Date(Date.UTC(y,m,1));
    const firstDOW=first.getUTCDay();
    const offset=this.getStartOfWeekOffset(firstDOW);

    // Optional min/max clamps (kept to respect settings; not used for selectability)
    let minKey: number | null = this.minDataKey;
    let maxKey: number | null = this.maxDataKey;
    const cfgMin=this.parseISODate(this.dateRange.minDate);
    const cfgMax=this.parseISODate(this.dateRange.maxDate);
    const cfgMinKey = cfgMin? this.atUTC(cfgMin): null;
    const cfgMaxKey = cfgMax? this.atUTC(cfgMax): null;

    if (!this.dateRange.respectDataRange){
      minKey = cfgMinKey; maxKey = cfgMaxKey;
    } else {
      if(cfgMinKey!==null) minKey = (minKey!==null)? Math.max(minKey, cfgMinKey): cfgMinKey;
      if(cfgMaxKey!==null) maxKey = (maxKey!==null)? Math.min(maxKey, cfgMaxKey): cfgMaxKey;
    }

    const container = document.createElement('div');
    container.className='grid-days';
    container.classList.toggle('show-weeknums', this.settings.showWeekNumbers);

    // Optional DOW header row
    if (this.settings.showDOWHeader) {
      if(this.settings.showWeekNumbers){
        const wk=document.createElement('div');
        wk.className='weeknum';
        wk.textContent='Wk';
        container.appendChild(wk);
      }
      const dows = this.settings.startOfWeek==='Monday'
        ? ['Mon','Tue','Wed','Thu','Fri','Sat','Sun']
        : ['Sun','Mon','Tue','Wed','Thu','Fri','Sat'];
      for (let i=0;i<dows.length;i++){
        const e=document.createElement('div');
        e.className='dow';
        e.textContent=dows[i];
        container.appendChild(e);
      }
    }

    // We always render 6 rows x 7 days (42 cells) for a full month grid
    const totalCells=42;
    const firstCellDate=new Date(Date.UTC(y,m,1 - offset));

    for(let i=0;i<totalCells;i++){
      const dt = new Date(Date.UTC(
        firstCellDate.getUTCFullYear(),
        firstCellDate.getUTCMonth(),
        firstCellDate.getUTCDate()+i
      ));

      const k = Date.UTC(dt.getUTCFullYear(), dt.getUTCMonth(), dt.getUTCDate());
      const inMonth = (dt.getUTCMonth()===m);

      // If week numbers enabled, add week number at the start of each row
      if(this.settings.showWeekNumbers && (i%7===0)){
        const wn=document.createElement('div');
        wn.className='weeknum';
        wn.textContent=String(this.getISOWeek(dt));
        container.appendChild(wn);
      }

      // Selectability is strictly data-driven: only enable if the date exists in data
      const isDataDate = this.selectableKeys.has(k);

      const cell = document.createElement('div');
      cell.className = 'cell' + (inMonth?'':' other-month') + (isDataDate? ' selectable':' disabled');
      cell.textContent = String(dt.getUTCDate());

      // Item styling
      (cell as HTMLElement).style.fontSize = `${this.items.fontSize}px`;
      if (this.items.color && !this.selectedKeys.has(k)) (cell as HTMLElement).style.color = this.items.color;

      if (this.selectedKeys.has(k)) {
        cell.classList.add('selected');
        if (this.items.selectedColor) (cell as HTMLElement).style.color = this.items.selectedColor;
        if (this.items.boldSelected) (cell as HTMLElement).style.fontWeight = '700';
      }

      if(isDataDate){
        cell.onclick = (ev)=> this.handleClickDate(k, ev as MouseEvent);
        (cell as HTMLElement).tabIndex = 0;
        cell.onkeydown = (ev: KeyboardEvent)=>{ if(ev.key==='Enter' || ev.key===' '){ ev.preventDefault(); this.handleClickDate(k, ev as any as MouseEvent);} };
      }

      container.appendChild(cell);
    }

    this.gridEl.appendChild(container);
  }

  private renderMonthGrid(){
    const container=document.createElement('div');
    container.className='grid-months';
    for(let m=0;m<12;m++){
      const cell=document.createElement('div');
      cell.className='cell selectable';
      (cell as HTMLElement).style.fontSize = `${this.items.fontSize}px`;
      cell.textContent=this.monthName(m);
      cell.onclick=()=>{ this.cursorMonth=m; this.viewMode='day'; this.render(); };
      container.appendChild(cell);
    }
    this.gridEl.appendChild(container);
  }

  private renderYearGrid(){
    const container=document.createElement('div');
    container.className='grid-years';
    const base=Math.floor(this.cursorYear/12)*12;
    for(let i=0;i<12;i++){
      const y=base+i;
      const cell=document.createElement('div');
      cell.className='cell selectable';
      (cell as HTMLElement).style.fontSize = `${this.items.fontSize}px`;
      cell.textContent=String(y);
      cell.onclick=()=>{ this.cursorYear=y; this.viewMode='month'; this.render(); };
      container.appendChild(cell);
    }
    this.gridEl.appendChild(container);
  }

  // -----------------------------
  // Selection & Filtering
  // -----------------------------

  private handleClickDate(key:number, ev: MouseEvent){
    const multiKey = this.selectionSettings.multiSelect && (ev.ctrlKey || ev.metaKey);
    const rangeKey = this.selectionSettings.rangeSelect && ev.shiftKey && this.lastClickedKey!=null;

    if(rangeKey){
      const a = (this.lastClickedKey as number);
      const start = key < a ? key : a;
      const end   = key < a ? a   : key;

      const keys: number[] = [];
      // Walk day by day and collect ONLY data-present dates
      let cursor = new Date(start);
      const endDate=new Date(end);
      while(this.atUTC(cursor) <= this.atUTC(endDate)){
        const k = this.atUTC(cursor);
        if (this.selectableKeys.has(k)) keys.push(k);
        cursor = new Date(Date.UTC(cursor.getUTCFullYear(), cursor.getUTCMonth(), cursor.getUTCDate()+1));
      }

      this.applyFilterForKeys(keys, true);
      this.lastClickedKey = key;
      this.render();
      return;
    }

    if(multiKey){
      if(this.selectedKeys.has(key)) this.selectedKeys.delete(key);
      else this.selectedKeys.add(key);
      this.applyFilterForKeys(this.setToArray(this.selectedKeys), true);
    } else {
      this.selectedKeys.clear();
      this.selectedKeys.add(key);
      this.applyFilterForKeys([key], false);
    }

    this.lastClickedKey = key;
    this.render();
  }

  private setToArray(s: Set<number>): number[] {
    const arr: number[] = [];
    s.forEach(v => arr.push(v));
    return arr;
  }

  private applyFilterForKeys(keys: number[], additive: boolean){
    if(!this.filterTarget) return;

    if(!additive){
      this.selectedKeys.clear();
      for (let i=0;i<keys.length;i++) this.selectedKeys.add(keys[i]);
    } else {
      for (let i=0;i<keys.length;i++) this.selectedKeys.add(keys[i]);
    }

    // Convert to Date[] for Basic 'In' filter
    const tmp:number[] = this.setToArray(this.selectedKeys);
    const values = tmp.map(k=> new Date(k));

    const filter: any = {
      $schema: "http://powerbi.com/product/schema#basic",
      target: { table: this.filterTarget.table, column: this.filterTarget.column },
      operator: "In",
      values
    };

    this.host.applyJsonFilter(filter, "general", "filter", powerbi.FilterAction.merge);
  }

  private clearSelection(){
    this.selectedKeys.clear();
    this.lastClickedKey=null;
    if(this.filterTarget){
      this.host.applyJsonFilter(null, "general", "filter", powerbi.FilterAction.remove);
    }
    this.render();
  }
}
