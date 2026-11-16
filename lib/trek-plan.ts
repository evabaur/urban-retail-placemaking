export type TrekStop = { time: string; name: string; address?: string; note: string; tentative?: boolean };
export type TrekPlan = { id: string; title: string; date: string; area: string; subtitle: string; stops: TrekStop[] };
// Sample itineraries for the showcase build. Districts are real NYC neighborhoods; stores and times are fictional.
export const TREKS: TrekPlan[] = [
  { id: 'trek1', title: 'Madison Avenue', date: '06 NOV', area: 'Uptown', subtitle: 'Heritage retail on a classic avenue', stops: [
    {time:'09:00',name:'Sample Flagship A',note:'Guided store tour. Meet at the main entrance.'},
    {time:'10:30–11:30',name:'District walk',note:'Walk the avenue with a local business-district guide.'}
  ]},
  { id: 'trek2', title: 'Meatpacking District', date: '13 NOV', area: 'West Side', subtitle: 'A neighborhood in transformation', stops: [
    {time:'09:30–10:45',name:'Sample Store B',note:'Whole-class visit.'},
    {time:'11:00–12:15',name:'District walk',note:'Guided walk through the district.'},
    {time:'12:30',name:'Sample Store C',note:'Whole-class visit.'}
  ]},
  { id: 'trek3', title: 'SoHo', date: '20 NOV', area: 'Downtown', subtitle: 'Brand worlds on the street', stops: [
    {time:'09:00',name:'Sample Flagship D',note:'Whole-group visit.'},
    {time:'10:00 / 10:30',name:'Sample Store E',note:'Two groups; the waiting group explores the block.'},
    {time:'Time pending',name:'Sample Store F',note:'Sequence to be confirmed.',tentative:true}
  ]}
];
