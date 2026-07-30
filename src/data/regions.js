// States/provinces/regions for a subset of priority countries, keyed by
// ISO alpha-2 country code. Offline/loading fallback for useRegions() —
// kept in sync with wallet-backend/alembic/versions/0014_regions.py.
// Countries not listed here have no structured region data; the UI falls
// back to a free-text input for those.
const REGIONS = {
  SN: [
    "Dakar", "Diourbel", "Fatick", "Kaffrine", "Kaolack", "Kédougou", "Kolda",
    "Louga", "Matam", "Saint-Louis", "Sédhiou", "Tambacounda", "Thiès", "Ziguinchor",
  ].map(name => ({ name, code: null })),
  CI: [
    "Abidjan", "Bas-Sassandra", "Comoé", "Denguélé", "Gôh-Djiboua", "Lacs", "Lagunes",
    "Montagnes", "Sassandra-Marahoué", "Savanes", "Vallée du Bandama", "Woroba",
    "Yamoussoukro", "Zanzan",
  ].map(name => ({ name, code: null })),
  ML: [
    "Bamako", "Kayes", "Koulikoro", "Sikasso", "Ségou", "Mopti", "Tombouctou",
    "Gao", "Kidal", "Ménaka", "Taoudénit",
  ].map(name => ({ name, code: null })),
  GN: ["Boké", "Conakry", "Faranah", "Kankan", "Kindia", "Labé", "Mamou", "Nzérékoré"]
    .map(name => ({ name, code: null })),
  BF: [
    "Boucle du Mouhoun", "Cascades", "Centre", "Centre-Est", "Centre-Nord",
    "Centre-Ouest", "Centre-Sud", "Est", "Hauts-Bassins", "Nord",
    "Plateau-Central", "Sahel", "Sud-Ouest",
  ].map(name => ({ name, code: null })),
  NE: ["Agadez", "Diffa", "Dosso", "Maradi", "Niamey", "Tahoua", "Tillabéri", "Zinder"]
    .map(name => ({ name, code: null })),
  TG: ["Maritime", "Plateaux", "Centrale", "Kara", "Savanes"].map(name => ({ name, code: null })),
  BJ: [
    "Alibori", "Atacora", "Atlantique", "Borgou", "Collines", "Donga",
    "Kouffo", "Littoral", "Mono", "Ouémé", "Plateau", "Zou",
  ].map(name => ({ name, code: null })),
  MR: [
    "Hodh Ech Chargui", "Hodh El Gharbi", "Assaba", "Gorgol", "Brakna", "Trarza",
    "Adrar", "Dakhlet Nouadhibou", "Tagant", "Guidimaka", "Tiris Zemmour",
    "Inchiri", "Nouakchott",
  ].map(name => ({ name, code: null })),
  GM: ["Banjul", "Kanifing", "West Coast", "Lower River", "North Bank", "Central River", "Upper River"]
    .map(name => ({ name, code: null })),
  GW: ["Bafatá", "Biombo", "Bissau", "Bolama", "Cacheu", "Gabú", "Oio", "Quinara", "Tombali"]
    .map(name => ({ name, code: null })),
  CV: ["Boa Vista", "Brava", "Fogo", "Maio", "Sal", "Santo Antão", "São Nicolau", "São Vicente", "Santiago"]
    .map(name => ({ name, code: null })),
  SL: ["Eastern", "Northern", "North West", "Southern", "Western Area"].map(name => ({ name, code: null })),
  LR: [
    "Bomi", "Bong", "Gbarpolu", "Grand Bassa", "Grand Cape Mount", "Grand Gedeh",
    "Grand Kru", "Lofa", "Margibi", "Maryland", "Montserrado", "Nimba",
    "River Cess", "River Gee", "Sinoe",
  ].map(name => ({ name, code: null })),
  GH: [
    "Ahafo", "Ashanti", "Bono", "Bono East", "Central", "Eastern", "Greater Accra",
    "North East", "Northern", "Oti", "Savannah", "Upper East", "Upper West",
    "Volta", "Western", "Western North",
  ].map(name => ({ name, code: null })),
  NG: [
    "Abia", "Adamawa", "Akwa Ibom", "Anambra", "Bauchi", "Bayelsa", "Benue", "Borno",
    "Cross River", "Delta", "Ebonyi", "Edo", "Ekiti", "Enugu", "Gombe", "Imo",
    "Jigawa", "Kaduna", "Kano", "Katsina", "Kebbi", "Kogi", "Kwara", "Lagos",
    "Nasarawa", "Niger", "Ogun", "Ondo", "Osun", "Oyo", "Plateau", "Rivers",
    "Sokoto", "Taraba", "Yobe", "Zamfara", "Federal Capital Territory",
  ].map(name => ({ name, code: null })),
  US: [
    ["Alabama", "AL"], ["Alaska", "AK"], ["Arizona", "AZ"], ["Arkansas", "AR"],
    ["California", "CA"], ["Colorado", "CO"], ["Connecticut", "CT"], ["Delaware", "DE"],
    ["Florida", "FL"], ["Georgia", "GA"], ["Hawaii", "HI"], ["Idaho", "ID"],
    ["Illinois", "IL"], ["Indiana", "IN"], ["Iowa", "IA"], ["Kansas", "KS"],
    ["Kentucky", "KY"], ["Louisiana", "LA"], ["Maine", "ME"], ["Maryland", "MD"],
    ["Massachusetts", "MA"], ["Michigan", "MI"], ["Minnesota", "MN"], ["Mississippi", "MS"],
    ["Missouri", "MO"], ["Montana", "MT"], ["Nebraska", "NE"], ["Nevada", "NV"],
    ["New Hampshire", "NH"], ["New Jersey", "NJ"], ["New Mexico", "NM"], ["New York", "NY"],
    ["North Carolina", "NC"], ["North Dakota", "ND"], ["Ohio", "OH"], ["Oklahoma", "OK"],
    ["Oregon", "OR"], ["Pennsylvania", "PA"], ["Rhode Island", "RI"], ["South Carolina", "SC"],
    ["South Dakota", "SD"], ["Tennessee", "TN"], ["Texas", "TX"], ["Utah", "UT"],
    ["Vermont", "VT"], ["Virginia", "VA"], ["Washington", "WA"], ["West Virginia", "WV"],
    ["Wisconsin", "WI"], ["Wyoming", "WY"], ["District of Columbia", "DC"],
  ].map(([name, code]) => ({ name, code })),
  CA: [
    ["Alberta", "AB"], ["British Columbia", "BC"], ["Manitoba", "MB"],
    ["New Brunswick", "NB"], ["Newfoundland and Labrador", "NL"], ["Nova Scotia", "NS"],
    ["Ontario", "ON"], ["Prince Edward Island", "PE"], ["Quebec", "QC"],
    ["Saskatchewan", "SK"], ["Northwest Territories", "NT"], ["Nunavut", "NU"],
    ["Yukon", "YT"],
  ].map(([name, code]) => ({ name, code })),
  GB: ["England", "Scotland", "Wales", "Northern Ireland"].map(name => ({ name, code: null })),
  FR: [
    "Auvergne-Rhône-Alpes", "Bourgogne-Franche-Comté", "Bretagne", "Centre-Val de Loire",
    "Corse", "Grand Est", "Hauts-de-France", "Île-de-France", "Normandie",
    "Nouvelle-Aquitaine", "Occitanie", "Pays de la Loire", "Provence-Alpes-Côte d'Azur",
  ].map(name => ({ name, code: null })),
}

export default REGIONS
