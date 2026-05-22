export interface MtrStation {
  code: string;
  name_tc: string;
  name_en: string;
}

export interface MtrLine {
  code: string;
  name_tc: string;
  name_en: string;
  color: string;
  stations: MtrStation[];
}

export const MTR_LINES: MtrLine[] = [
  {
    code: "KTL",
    name_tc: "觀塘綫",
    name_en: "Kwun Tong Line",
    color: "bg-[#00ab5c]",
    stations: [
      { code: "WHA", name_tc: "黃埔", name_en: "Whampoa" },
      { code: "HOM", name_tc: "何文田", name_en: "Ho Man Tin" },
      { code: "YMT", name_tc: "油麻地", name_en: "Yau Ma Tei" },
      { code: "MOK", name_tc: "旺角", name_en: "Mong Kok" },
      { code: "PRE", name_tc: "太子", name_en: "Prince Edward" },
      { code: "SKM", name_tc: "石硤尾", name_en: "Shek Kip Mei" },
      { code: "KOT", name_tc: "九龍塘", name_en: "Kowloon Tong" },
      { code: "LOF", name_tc: "樂富", name_en: "Lok Fu" },
      { code: "WTS", name_tc: "黃大仙", name_en: "Wong Tai Sin" },
      { code: "DIH", name_tc: "鑽石山", name_en: "Diamond Hill" },
      { code: "CHH", name_tc: "彩虹", name_en: "Choi Hung" },
      { code: "KOB", name_tc: "九龍灣", name_en: "Kowloon Bay" },
      { code: "NTK", name_tc: "牛頭角", name_en: "Ngau Tau Kok" },
      { code: "KWT", name_tc: "觀塘", name_en: "Kwun Tong" },
      { code: "LAT", name_tc: "藍田", name_en: "Lam Tin" },
      { code: "YAT", name_tc: "油塘", name_en: "Yau Tong" },
      { code: "TIK", name_tc: "調景嶺", name_en: "Tiu Keng Leng" }
    ]
  },
  {
    code: "ISL",
    name_tc: "港島綫",
    name_en: "Island Line",
    color: "bg-[#007cd3]",
    stations: [
      { code: "KET", name_tc: "堅尼地城", name_en: "Kennedy Town" },
      { code: "HKU", name_tc: "香港大學", name_en: "HKU" },
      { code: "SYP", name_tc: "西營盤", name_en: "Sai Ying Pun" },
      { code: "SHW", name_tc: "上環", name_en: "Sheung Wan" },
      { code: "CEN", name_tc: "中環", name_en: "Central" },
      { code: "ADM", name_tc: "金鐘", name_en: "Admiralty" },
      { code: "WAC", name_tc: "灣仔", name_en: "Wan Chai" },
      { code: "CWB", name_tc: "銅鑼灣", name_en: "Causeway Bay" },
      { code: "TIH", name_tc: "天后", name_en: "Tin Hau" },
      { code: "FOH", name_tc: "炮台山", name_en: "Fortress Hill" },
      { code: "NOP", name_tc: "北角", name_en: "North Point" },
      { code: "QUB", name_tc: "鰂魚涌", name_en: "Quarry Bay" },
      { code: "TAK", name_tc: "太古", name_en: "Tai Koo" },
      { code: "SWH", name_tc: "西灣河", name_en: "Sai Wan Ho" },
      { code: "SKW", name_tc: "筲箕灣", name_en: "Shau Kei Wan" },
      { code: "HFC", name_tc: "杏花邨", name_en: "Heng Fa Chuen" },
      { code: "CHW", name_tc: "柴灣", name_en: "Chai Wan" }
    ]
  },
  {
    code: "TWL",
    name_tc: "荃灣綫",
    name_en: "Tsuen Wan Line",
    color: "bg-[#e21b18]",
    stations: [
      { code: "CEN", name_tc: "中環", name_en: "Central" },
      { code: "ADM", name_tc: "金鐘", name_en: "Admiralty" },
      { code: "TST", name_tc: "尖沙咀", name_en: "Tsim Sha Tsui" },
      { code: "JOR", name_tc: "佐敦", name_en: "Jordan" },
      { code: "YMT", name_tc: "油麻地", name_en: "Yau Ma Tei" },
      { code: "MOK", name_tc: "旺角", name_en: "Mong Kok" },
      { code: "PRE", name_tc: "太子", name_en: "Prince Edward" },
      { code: "SSP", name_tc: "深水埗", name_en: "Sham Shui Po" },
      { code: "LCK", name_tc: "荔枝角", name_en: "Lai Chi Kok" },
      { code: "MEF", name_tc: "美孚", name_en: "Mei Foo" },
      { code: "LAK", name_tc: "荔景", name_en: "Lai King" },
      { code: "KWF", name_tc: "葵芳", name_en: "Kwai Fong" },
      { code: "KWH", name_tc: "葵興", name_en: "Kwai Hing" },
      { code: "TWH", name_tc: "大窩口", name_en: "Tai Wo Hau" },
      { code: "TSW", name_tc: "荃灣", name_en: "Tsuen Wan" }
    ]
  },
  {
    code: "TKL",
    name_tc: "將軍澳綫",
    name_en: "Tseung Kwan O Line",
    color: "bg-[#a35eb5]",
    stations: [
      { code: "NOP", name_tc: "北角", name_en: "North Point" },
      { code: "QUB", name_tc: "鰂魚涌", name_en: "Quarry Bay" },
      { code: "YAT", name_tc: "油塘", name_en: "Yau Tong" },
      { code: "TIK", name_tc: "調景嶺", name_en: "Tiu Keng Leng" },
      { code: "TKO", name_tc: "將軍澳", name_en: "Tseung Kwan O" },
      { code: "HAH", name_tc: "坑口", name_en: "Hang Hau" },
      { code: "POA", name_tc: "寶琳", name_en: "Po Lam" },
      { code: "LHP", name_tc: "康城", name_en: "LOHAS Park" }
    ]
  },
  {
    code: "EAL",
    name_tc: "東鐵綫",
    name_en: "East Rail Line",
    color: "bg-[#5ebfc4]",
    stations: [
      { code: "ADM", name_tc: "金鐘", name_en: "Admiralty" },
      { code: "EXH", name_tc: "會展", name_en: "Exhibition Centre" },
      { code: "HUH", name_tc: "紅磡", name_en: "Hung Hom" },
      { code: "MKK", name_tc: "旺角東", name_en: "Mong Kok East" },
      { code: "KOT", name_tc: "九龍塘", name_en: "Kowloon Tong" },
      { code: "TAF", name_tc: "大圍", name_en: "Tai Wai" },
      { code: "SHT", name_tc: "沙田", name_en: "Sha Tin" },
      { code: "FOT", name_tc: "火炭", name_en: "Fo Tan" },
      { code: "RAC", name_tc: "馬場", name_en: "Racecourse" },
      { code: "UNI", name_tc: "大學", name_en: "University" },
      { code: "TAP", name_tc: "大埔墟", name_en: "Tai Po Market" },
      { code: "TWO", name_tc: "太和", name_en: "Tai Wo" },
      { code: "FAN", name_tc: "粉嶺", name_en: "Fanling" },
      { code: "SHS", name_tc: "上水", name_en: "Sheung Shui" },
      { code: "LOW", name_tc: "羅湖", name_en: "Lo Wu" },
      { code: "LMC", name_tc: "落馬洲", name_en: "Lok Ma Chau" }
    ]
  },
  {
    code: "TML",
    name_tc: "屯馬綫",
    name_en: "Tuen Ma Line",
    color: "bg-[#9a382c]",
    stations: [
      { code: "WKS", name_tc: "烏溪沙", name_en: "Wu Kai Sha" },
      { code: "MOS", name_tc: "馬鞍山", name_en: "Ma On Shan" },
      { code: "HEO", name_tc: "恆安", name_en: "Heng On" },
      { code: "TSH", name_tc: "大水坑", name_en: "Tai Shui Hang" },
      { code: "MSH", name_tc: "石門", name_en: "Shek Mun" },
      { code: "CIO", name_tc: "第一城", name_en: "City One" },
      { code: "STW", name_tc: "沙田圍", name_en: "Sha Tin Wai" },
      { code: "TAF", name_tc: "大圍", name_en: "Tai Wai" },
      { code: "HIK", name_tc: "顯徑", name_en: "Hin Keng" },
      { code: "DIH", name_tc: "鑽石山", name_en: "Diamond Hill" },
      { code: "CKW", name_tc: "啟德", name_en: "Kai Tak" },
      { code: "SUW", name_tc: "宋皇臺", name_en: "Sung Wong Toi" },
      { code: "TKW", name_tc: "土瓜灣", name_en: "To Kwa Wan" },
      { code: "HOM", name_tc: "何文田", name_en: "Ho Man Tin" },
      { code: "HUH", name_tc: "紅磡", name_en: "Hung Hom" },
      { code: "ETS", name_tc: "尖東", name_en: "East Tsim Sha Tsui" },
      { code: "AUS", name_tc: "柯士甸", name_en: "Austin" },
      { code: "NAC", name_tc: "南昌", name_en: "Nam Cheong" },
      { code: "MEF", name_tc: "美孚", name_en: "Mei Foo" },
      { code: "TWW", name_tc: "荃灣西", name_en: "Tsuen Wan West" },
      { code: "KSR", name_tc: "錦上路", name_en: "Kam Sheung Road" },
      { code: "YUL", name_tc: "元朗", name_en: "Yuen Long" },
      { code: "LOP", name_tc: "朗屏", name_en: "Long Ping" },
      { code: "TIS", name_tc: "天水圍", name_en: "Tin Shui Wai" },
      { code: "SIH", name_tc: "兆康", name_en: "Siu Hong" },
      { code: "TUM", name_tc: "屯門", name_en: "Tuen Mun" }
    ]
  },
  {
    code: "TCL",
    name_tc: "東涌綫",
    name_en: "Tung Chung Line",
    color: "bg-[#f39712]",
    stations: [
      { code: "HOK", name_tc: "香港", name_en: "Hong Kong" },
      { code: "KOW", name_tc: "九龍", name_en: "Kowloon" },
      { code: "OLY", name_tc: "奧運", name_en: "Olympic" },
      { code: "NAC", name_tc: "南昌", name_en: "Nam Cheong" },
      { code: "LAK", name_tc: "荔景", name_en: "Lai King" },
      { code: "TSY", name_tc: "青衣", name_en: "Tsing Yi" },
      { code: "SUN", name_tc: "欣澳", name_en: "Sunny Bay" },
      { code: "TUC", name_tc: "東涌", name_en: "Tung Chung" }
    ]
  },
  {
    code: "AEL",
    name_tc: "機場快綫",
    name_en: "Airport Express",
    color: "bg-[#007078]",
    stations: [
      { code: "HOK", name_tc: "香港", name_en: "Hong Kong" },
      { code: "KOW", name_tc: "九龍", name_en: "Kowloon" },
      { code: "TSY", name_tc: "青衣", name_en: "Tsing Yi" },
      { code: "AIR", name_tc: "機場", name_en: "Airport" },
      { code: "AWE", name_tc: "博覽館", name_en: "AsiaWorld-Expo" }
    ]
  },
  {
    code: "SIL",
    name_tc: "南港島綫",
    name_en: "South Island Line",
    color: "bg-[#b5bd00]",
    stations: [
      { code: "ADM", name_tc: "金鐘", name_en: "Admiralty" },
      { code: "OCP", name_tc: "海洋公園", name_en: "Ocean Park" },
      { code: "WCH", name_tc: "黃竹坑", name_en: "Wong Chuk Hang" },
      { code: "LET", name_tc: "利東", name_en: "Lei Tung" },
      { code: "SOH", name_tc: "海怡半島", name_en: "South Horizons" }
    ]
  }
];

export function getStationName(code: string): { tc: string; en: string } {
  for (const line of MTR_LINES) {
    const station = line.stations.find((s) => s.code === code);
    if (station) {
      return { tc: station.name_tc, en: station.name_en };
    }
  }
  return { tc: code, en: code };
}
