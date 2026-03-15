import { auth, dbCloud } from "./firebase"
import { query, orderBy } from "firebase/firestore"
import {
  GoogleAuthProvider,
  signInWithPopup,
  signInAnonymously,
  signOut,
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword
} from "firebase/auth"
import React, { useEffect, useState, useMemo } from "react";
import { Routes, Route, useNavigate, useParams } from "react-router-dom";
import { db } from "./db";
import type { Character } from "./db";
import { onAuthStateChanged } from "firebase/auth"
import { getDocs, collection, doc, setDoc, deleteDoc, onSnapshot } from "firebase/firestore"
import { getDoc } from "firebase/firestore"
import { useRef } from "react"

const prefectures = [
"北海道",
"青森","岩手","宮城","秋田","山形","福島",
"茨城","栃木","群馬","埼玉","千葉","東京","神奈川",
"新潟","富山","石川","福井",
"山梨","長野",
"岐阜","静岡","愛知","三重",
"滋賀","京都","大阪","兵庫","奈良","和歌山",
"鳥取","島根","岡山","広島","山口",
"徳島","香川","愛媛","高知",
"福岡","佐賀","長崎","熊本","大分","宮崎","鹿児島",
"沖縄"
];

const prefectureOrder = [
"北海道",
"青森","岩手","宮城","秋田","山形","福島",
"茨城","栃木","群馬","埼玉","千葉","東京","神奈川",
"新潟","富山","石川","福井",
"山梨","長野",
"岐阜","静岡","愛知","三重",
"滋賀","京都","大阪","兵庫","奈良","和歌山",
"鳥取","島根","岡山","広島","山口",
"徳島","香川","愛媛","高知",
"福岡","佐賀","長崎","熊本","大分","宮崎","鹿児島",
"沖縄"
];

function getPrefectureIndex(place: string) {

  const normalized = normalizeText(place);

  const index = prefectureOrder.findIndex(p =>
    normalized.includes(normalizeText(p))
  );

  return index === -1 ? 999 : index;

}

function getDamageBonus(str: number, siz: number) {
  const total = str + siz;

  if (total <= 12) return "-1d6";
  if (total <= 16) return "-1d4";
  if (total <= 24) return "0";
  if (total <= 32) return "1d4";
  if (total <= 40) return "1d6";
  if (total <= 56) return "2d6";
  if (total <= 72) return "3d6";

  return "4d6";
}

function normalizeText(text: string) {
  return text
    .replace(/[都道府県]/g, "")  // 都道府県除去
    .replace(/\s+/g, "")         // 空白削除
    .toLowerCase();              // 大文字小文字無視
}

function normalizeSkillAlias(name: string): string {

  const alias: Record<string,string> = {

    "コンピュータ":"コンピューター",
    "聞耳":"聞き耳",
    "忍び歩く":"忍び歩き",
    "ナビ":"ナビゲート",
    "図書":"図書館",
    "こぶし":"こぶし（パンチ）"

  };

  return alias[name] ?? name;

}

function normalizeSkillName(name: string): string {

  const n = name
    .replace(/\u3000/g, " ")
    .replace(/[()（）]/g, "")
    .replace(/\s+/g, " ")
    .trim();

  if (n.includes("母語")) return "母国語";

  return n;
}

function getBaseSkillValue(char: Character, skillName: string): number {
  const status = char.status ?? {};

  const baseName = normalizeSkillName(skillName);
if (baseName.includes("運転")) return 20;
if (baseName.includes("操縦")) return 20;
if (baseName.includes("芸術")) return 5;
if (baseName.includes("製作")) return 5;
if (baseName.includes("語") && baseName !== "母国語") return 1;
if (baseName.includes("こぶし")) return 50;

  switch (baseName) {

case "母国語":
  return (status.EDU ?? 0) * 5;

    /* ===== ステータス依存 ===== */

    case "回避":
      return (status.DEX ?? 0) * 2;

    case "アイデア":
      return (status.INT ?? 0) * 5;

case "知識":
  return (status.EDU ?? 0) * 5;

    case "幸運":
      return (status.POW ?? 0) * 5;

    case "母国語":
      return (status.EDU ?? 0) * 5;

    /* ===== 戦闘 ===== */
    case "こぶし（パンチ）":
      return 50;

    case "キック":
    case "組み付き":
    case "頭突き":
    case "投擲":
      return 25;

    case "拳銃":
      return 20;

    case "サブマシンガン":
      return 15;

    case "ショットガン":
      return 30;

    case "マシンガン":
      return 15;

    case "ライフル":
      return 25;

    /* ===== 探索 ===== */

    case "目星":
    case "聞き耳":
    case "図書館":
    case "言いくるめ":
    case "説得":
    case "信用":
    case "値切り":
    case "水泳":
    case "跳躍":
      return 25;

    case "歴史":
    case "機械修理":
      return 20;

    case "応急手当":
      return 30;

    case "精神分析":
    case "鍵開け":
    case "重機械操作":
    case "コンピュータ":
    case "マーシャルアーツ":
      return 1;

    case "医学":
    case "心理学":
    case "ナビゲート":
    case "写真術":
      return 10;

    case "隠れる":
    case "忍び歩き":
    case "電気修理":
      return 10;

    case "隠す":
      return 15;

    case "登攀":
      return 40;

    case "追跡":
    case "博物学":
    case "経理":
      return 10;

    case "オカルト":
    case "法律":
    case "乗馬":
      return 5;

    /* ===== 知識 ===== */

    case "クトゥルフ神話":
      return 0;

    case "生物学":
    case "地質学":
    case "電子工学":
    case "天文学":
    case "物理学":
    case "薬学":
    case "人類学":
    case "考古学":
    case "化学":
    case "コンピューター":
    case "変装":
      return 1;

    default:
      // 未知技能は初期値扱いしない（＝成長扱いにしない）
      return -1;
  }
}

/* =========================
   App
========================= */

function App() {
  const [characters, setCharacters] = useState<Character[]>([]);
const [skillSort, setSkillSort] = useState("desc");
const [skillTotalSort, setSkillTotalSort] = useState(false);
  const [searchSkill, setSearchSkill] = useState("");
  const [searchValue, setSearchValue] = useState("");
const [birthplaceSearch, setBirthplaceSearch] = useState("");
const [birthplaceText, setBirthplaceText] = useState("");
const [genderSearch, setGenderSearch] = useState("");
const [occupationSearch, setOccupationSearch] = useState("");
const [charasheetUrl, setCharasheetUrl] = useState("");
const [ageSearch, setAgeSearch] = useState("");
const [ageSearchMax, setAgeSearchMax] = useState("");
const [ageSort, setAgeSort] = useState<"desc" | "asc">("desc");
const [user, setUser] = useState<any>(null)
const [email, setEmail] = useState("")
const [password, setPassword] = useState("")
const [authLoading, setAuthLoading] = useState(true)
const [showSettings, setShowSettings] = useState(false)
const [showLogin, setShowLogin] = useState(false)
const [loginId, setLoginId] = useState("")
const [loginPass, setLoginPass] = useState("")
const [showRegister,setShowRegister] = useState(false)
const [registerId,setRegisterId] = useState("")
const [registerPass,setRegisterPass] = useState("")
const settingsRef = useRef<HTMLDivElement>(null)
const loginRef = useRef<HTMLDivElement>(null)
const registerRef = useRef<HTMLDivElement>(null)

  useEffect(() => {

  const unsub = onAuthStateChanged(auth, async (u) => {

    setUser(u)
    setAuthLoading(false)

    if (!u) return

    const q = query(
  collection(dbCloud, "users", u.uid, "characters"),
  orderBy("createdAt", "desc")
)

onSnapshot(q, async (snap) => {

  const list = snap.docs.map(d => ({
    id: d.id,
    ...d.data()
  })) as Character[]
  

  for (const c of list) {
    await db.characters.put(c)
  }

  setCharacters(await db.characters.toArray())

})

    for (const c of list) {
      await db.characters.put(c)
    }

    setCharacters(await db.characters.toArray())

  })

  return () => unsub()

}, [])

useEffect(() => {
  db.characters.toArray().then(setCharacters)
}, [])

useEffect(()=>{

const handleClick = (e:MouseEvent)=>{

const target = e.target as Node

// ⚙メニュー
if(
settingsRef.current &&
!settingsRef.current.contains(target) &&
!showLogin &&
!showRegister
){
setShowSettings(false)
}

// ログイン
if(
loginRef.current &&
!loginRef.current.contains(target)
){
setShowLogin(false)
}

// 新規登録
if(
registerRef.current &&
!registerRef.current.contains(target)
){
setShowRegister(false)
}

}

document.addEventListener("mousedown",handleClick)

return ()=>{
document.removeEventListener("mousedown",handleClick)
}

},[])

const loginEmail = async () => {
  const id = prompt("ユーザーID")
  const password = prompt("パスワード")

  if (!id || !password) return

  const email = `${id}@coc.app`

  await signInWithEmailAndPassword(auth, email, password)
}

const registerEmail = async () => {

  const id = prompt("ユーザーID")
  const password = prompt("パスワード")

  if (!id || !password) return

  const idDoc = await getDoc(doc(dbCloud, "userIds", id))

  if (idDoc.exists()) {
    alert("このIDは既に使われています")
    return
  }

  const email = `${id}@coc.app`

  const userCred = await createUserWithEmailAndPassword(
    auth,
    email,
    password
  )

  await setDoc(doc(dbCloud, "userIds", id), {
    uid: userCred.user.uid
  })
}

const loginGoogle = async () => {
  const provider = new GoogleAuthProvider()
  await signInWithPopup(auth, provider)
}

const loginGuest = async () => {
  await signInAnonymously(auth)
}

const logout = async () => {
  await signOut(auth)
}

const [heightSearch, setHeightSearch] = useState("");
  const [ageMode, setAgeMode] = useState<"gte" | "lte">("gte");
  const [heightMode, setHeightMode] = useState<"gte" | "lte">("gte");
const [sanMode, setSanMode] = useState<"gte" | "lte">("gte");
const [columns, setColumns] = useState<1 | 2 | 4 | "auto">("auto");
const [sortMode, setSortMode] = useState("created")
const [textInput, setTextInput] = useState("");
const [showDetails, setShowDetails] = useState(false);
const [showMatchedOnly, setShowMatchedOnly] = useState(true);
const [statusMode, setStatusMode] =
  useState<"gte" | "lte">("gte");
const [damageBonusSearch, setDamageBonusSearch] =
  useState("");
const [statusSearch, setStatusSearch] = useState({

  STR: "",
  CON: "",
  POW: "",
  DEX: "",
  APP: "",
  SIZ: "",
  INT: "",
  EDU: "",
  SAN: "",
  HP: "",
  MP: "",
});

const [activeTab, setActiveTab] = useState<"search" | "list">("list");
const [isMobile, setIsMobile] = useState(
  window.innerWidth < 768
);

function showMessage(msg: string) {

  const div = document.createElement("div");

  div.innerText = msg;

  div.style.position = "fixed";
  div.style.bottom = "20px";
  div.style.right = "20px";
  div.style.background = "#000";
  div.style.color = "#fff";
  div.style.padding = "12px 18px";
  div.style.borderRadius = "10px";
  div.style.fontSize = "14px";
  div.style.zIndex = "9999";

  document.body.appendChild(div);

  setTimeout(() => {
    div.remove();
  }, 2000); // ← 2秒で消える
}

useEffect(() => {
  const handleResize = () =>
    setIsMobile(window.innerWidth < 768);

  window.addEventListener("resize", handleResize);
  return () =>
    window.removeEventListener("resize", handleResize);
}, []);
  useEffect(() => {

  if (!searchSkill && !occupationSearch && !genderSearch) {
    db.characters.toArray().then(setCharacters);
    return;
  }

  let collection = db.characters.toCollection();

  if (occupationSearch) {
    collection = collection.filter(c =>
      c.occupation?.includes(occupationSearch)
    );
  }

  if (genderSearch) {
    collection = collection.filter(c =>
      c.gender === genderSearch
    );
  }

  collection.toArray().then(setCharacters);

}, [occupationSearch, genderSearch]);

  const deleteCharacter = async (id: string) => {
    await db.characters.delete(id);

if (user) {
  await deleteDoc(
    doc(dbCloud, "users", user.uid, "characters", id)
  )
}

    setCharacters(await db.characters.toArray());
  };
const importFromText = async () => {
  
const text = textInput.trim();
if (!text) return;
/* =========================
   キャラ保管所URL
========================= */

if (text.includes("charasheet.vampire-blood.net")) {

  const idMatch = text.match(/charasheet\.vampire-blood\.net\/(\d+)/);
  if (!idMatch) return;

  const id = idMatch[1];

  const res = await fetch(
    `https://charasheet.vampire-blood.net/${id}.js`
  );

  const raw = await res.text();
  const jsonText = raw.replace(/^var\s+data\s*=\s*/, "");
  const data = JSON.parse(jsonText);

  /* -----------------------
     能力値
  ----------------------- */

  const status = {
    STR: Number(data.NP1 ?? 0),
    CON: Number(data.NP2 ?? 0),
    POW: Number(data.NP3 ?? 0),
    DEX: Number(data.NP4 ?? 0),
    APP: Number(data.NP5 ?? 0),
    SIZ: Number(data.NP6 ?? 0),
    INT: Number(data.NP7 ?? 0),
    EDU: Number(data.NP8 ?? 0),
  };

  const hp = Number(data.NP9 ?? 0);
  const mp = Number(data.NP10 ?? 0);

  const sanCurrent = Number(data.SAN_Left ?? 0);
  const sanMax = Number(data.SAN_Max ?? 0);

  /* -----------------------
     技能
  ----------------------- */

  const skillNames = [
    "回避","キック","組み付き","こぶし","頭突き","投擲",
    "マーシャルアーツ","拳銃","サブマシンガン","ショットガン","マシンガン","ライフル",
    "応急手当","鍵開け","隠す","隠れる","聞き耳","忍び歩き",
    "写真術","精神分析","追跡","登攀","図書館","目星",
    "運転","機械修理","重機械操作","乗馬","水泳","製作",
    "操縦","跳躍","電気修理","ナビゲート","変装",
    "言いくるめ","信用","説得","値切り","母国語",
    "医学","オカルト","化学","クトゥルフ神話","芸術",
    "経理","考古学","コンピューター","心理学","人類学",
    "生物学","地質学","電子工学","天文学","博物学",
    "物理学","法律","薬学","歴史"
  ];

  const skillArrays = [
    ...(data.TBAP ?? []),
    ...(data.TFAP ?? []),
    ...(data.TAAP ?? []),
    ...(data.TCAP ?? []),
    ...(data.TKAP ?? [])
  ];

  const skills: { name: string; value: number }[] = [];

  skillArrays.forEach((v: any, i: number) => {

    const value = Number(v);

    if (!isNaN(value) && value > 0) {

      const name = skillNames[i] ?? `技能${i}`;

      skills.push({
        name,
        value
      });

    }

  });

  /* -----------------------
     キャラクター生成
  ----------------------- */

  const newChar: Character = {
  id: crypto.randomUUID(),

  name: name || "不明",
  furigana,

  occupation: occupation || "不明",
  birthplace: birthplace,
  birthday: birthday,

  gender,
  age,
  height,

  sanCurrent,
  sanMax,

  hp,
  mp,

  status,
  skills,

  imageUrl,
  sheetUrl,
  iacharaId,

  color: extractedColor,

  source: "text",

  createdAt: existingChar?.createdAt ?? Date.now(),
updatedAt: existingChar ? Date.now() : existingChar?.createdAt ?? Date.now(),
};

await db.characters.put(newChar)

if (user) {
  await setDoc(
    doc(dbCloud, "users", user.uid, "characters", newChar.id),
    newChar
  )
}

  setCharacters(await db.characters.toArray());

  setTextInput("");

  return;
}

// 🔽 JSON形式か判定

try {
  const parsed = JSON.parse(text);
  if (parsed.kind === "character" && parsed.data) {

    const d = parsed.data;

const sanObj = d.status?.find((s: any) => s.label === "SAN");
const hpObj = d.status?.find((s: any) => s.label === "HP");
const mpObj = d.status?.find((s: any) => s.label === "MP");

const statusObj: any = {};

(d.params ?? []).forEach((p: any) => {
  statusObj[p.label] = Number(p.value);
});

    const skills =
  d.commands
    ?.split("\n")
    .map((line: string) => {
      const match = line.match(/CCB<=([0-9]+)\s+【(.+?)】/);
      if (!match) return null;

      return {
  name: match[2],
  value: Number(match[1]),
  base: 0,
  job: 0,
  hobby: 0,
  growth: Number(match[1]),   // ←ここ
  other: 0
};
    })
    .filter(Boolean) ?? [];

const sheetUrl = d.externalUrl ?? "";

const iacharaIdMatch = sheetUrl.match(/view\/(\d+)/);
const iacharaId = iacharaIdMatch ? iacharaIdMatch[1] : "";

let existingChar = await db.characters
  .filter(c => iacharaId && c.iacharaId === iacharaId)
  .first();

if (!existingChar && sheetUrl) {
  existingChar = await db.characters
    .filter(c => c.sheetUrl === sheetUrl)
    .first();
}

  const mergedSkills = (() => {

  const map = new Map<string, any>();

  existingChar?.skills?.forEach(s => {
    map.set(normalizeSkillName(s.name), { ...s });
  });

  skills.forEach(s => {

    const old = map.get(normalizeSkillName(s.name));

    if (old) {

  const base = old.base ?? 0
  const job = old.job ?? 0
  const hobby = old.hobby ?? 0

  const growth = Math.max(
    0,
    s.value - (base + job + hobby)
  )

  map.set(normalizeSkillName(s.name),{
  ...old,
  value:s.value,
  growth
});

}

 else {

  map.set(normalizeSkillName(s.name),{
  name:s.name,
  value:s.value,
  base:-1,
  job:0,
  hobby:0,
  growth: existingChar ? 0 : 1,
  other:0
});

}

  });

  return Array.from(map.values());

})();

const rawName = d.name ?? existingChar?.name ?? "不明";

let name = rawName;
let furigana = existingChar?.furigana ?? "";

const kanaMatch = rawName.match(/[（(](.+?)[）)]/);

if (kanaMatch) {
  furigana = kanaMatch[1].trim();
  name = rawName.replace(/[（(].+?[）)]/, "").trim();
}

const isUpdate = !!existingChar;

const newChar: Character = {

  id: existingChar?.id ?? crypto.randomUUID(),

  name,
  furigana,

  occupation: existingChar?.occupation ?? "",
  gender: existingChar?.gender ?? "未設定",
  age: existingChar?.age ?? 0,
  height: existingChar?.height ?? 0,
  birthplace: existingChar?.birthplace ?? "",
  birthday: existingChar?.birthday ?? "",

  sanCurrent: sanObj?.value ?? existingChar?.sanCurrent ?? 0,
  sanMax: sanObj?.max ?? existingChar?.sanMax ?? 0,

  hp: hpObj?.value ?? existingChar?.hp ?? 0,
  mp: mpObj?.value ?? existingChar?.mp ?? 0,

  status: {
    STR: statusObj.STR ?? existingChar?.status?.STR ?? 0,
    CON: statusObj.CON ?? existingChar?.status?.CON ?? 0,
    POW: statusObj.POW ?? existingChar?.status?.POW ?? 0,
    DEX: statusObj.DEX ?? existingChar?.status?.DEX ?? 0,
    APP: statusObj.APP ?? existingChar?.status?.APP ?? 0,
    SIZ: statusObj.SIZ ?? existingChar?.status?.SIZ ?? 0,
    INT: statusObj.INT ?? existingChar?.status?.INT ?? 0,
    EDU: statusObj.EDU ?? existingChar?.status?.EDU ?? 0,
  },

  skills: mergedSkills,

  imageUrl: d.iconUrl ?? existingChar?.imageUrl ?? "",
  sheetUrl,

  color: d.color ?? "#dcdcdc",

  source: existingChar ? "text" : "json",

  createdAt: existingChar?.createdAt ?? Date.now(),
updatedAt: existingChar ? Date.now() : existingChar?.createdAt ?? Date.now(),
};

   await db.characters.put(newChar)

if (user) {
  await setDoc(
    doc(dbCloud, "users", user.uid, "characters", newChar.id),
    newChar
  )
}

if (isUpdate) {
  showMessage("キャラクターを更新しました");
} else {
  showMessage("キャラクターを追加しました");
}

setCharacters(await db.characters.toArray());
setTextInput("");
return;
  }

} catch (e) {
  // JSONじゃなかったらテキスト解析
}
  
// カラータグ取得（#XXXXXX）
const colorMatch = text.match(/#[0-9A-Fa-f]{6}/);
const extractedColor = colorMatch ? colorMatch[0] : "#dcdcdc";
  const getMatch = (regex: RegExp) => {
    const match = text.match(regex);
    return match ? match[1].trim() : "";
  };

  const nameMatch = text.match(/名前:\s*(.+)/);

let name = "";
let furigana = "";

if (nameMatch) {
  const raw = nameMatch[1];

  const kanaMatch = raw.match(/[（(](.+?)[）)]/);

  if (kanaMatch) {
    furigana = kanaMatch[1].trim();
    name = raw.replace(/[（(].+?[）)]/, "").trim();
  } else {
    name = raw.trim();
  }
}

const occupation = getMatch(/職業:\s*(.+)/);

const birthplaceMatch = text.match(/出身:\s*([^\/\n]+)/);
const birthplace = birthplaceMatch ? birthplaceMatch[1].trim() : "";

const birthdayMatch = text.match(/誕生日\s*:\s*(.+)/);
let birthday = birthdayMatch ? birthdayMatch[1].trim() : "";

if (birthday) {

  birthday = birthday
    .replace(/月/g, "/")
    .replace(/日/g, "")
    .replace(/-/g, "/");

  const parts = birthday.split("/");

  if (parts.length === 2) {
    birthday = `${Number(parts[0])}/${Number(parts[1])}`;
  }

}

const idMatch = text.match(/ID:(\d+)/);
const iacharaId = idMatch ? idMatch[1] : "";

const sheetUrl = iacharaId
  ? `https://iachara.com/view/${iacharaId}`
  : "";
// 🔽 年齢・性別・身長まとめて解析
const basicLineMatch = text.match(/年齢:.*$/m);
let gender = "";
let age = 0;
let height = 0;

if (basicLineMatch) {
  const parts = basicLineMatch[0].split("/");

  parts.forEach((part) => {
    if (part.includes("性別")) {
      gender = part.replace(/.*性別:\s*/, "").trim();
    }
    if (part.includes("年齢")) {
      const match = part.match(/\d+/);
      age = match ? Number(match[0]) : 0;
    }
    if (part.includes("身長")) {
      const match = part.match(/\d+/);
      height = match ? Number(match[0]) : 0;
    }
  });
}
const iconMatch = text.match(/【アイコン】\s*:?(.+)/);
const imageUrl = iconMatch ? iconMatch[1].trim() : "";

  const hp = Number(getMatch(/^HP\s+(\d+)/m)) || 0;
  const mp = Number(getMatch(/^MP\s+(\d+)/m)) || 0;

const sanMatch = text.match(/現在SAN値\s*(\d+)\s*[\/／]\s*(\d+)/);

const sanCurrent = sanMatch ? Number(sanMatch[1]) : 0;
const sanMax = sanMatch ? Number(sanMatch[2]) : 0;
  const status = {
    STR: Number(getMatch(/^STR\s+(\d+)/m)) || 0,
    CON: Number(getMatch(/^CON\s+(\d+)/m)) || 0,
    POW: Number(getMatch(/^POW\s+(\d+)/m)) || 0,
    DEX: Number(getMatch(/^DEX\s+(\d+)/m)) || 0,
    APP: Number(getMatch(/^APP\s+(\d+)/m)) || 0,
    SIZ: Number(getMatch(/^SIZ\s+(\d+)/m)) || 0,
    INT: Number(getMatch(/^INT\s+(\d+)/m)) || 0,
    EDU: Number(getMatch(/^EDU\s+(\d+)/m)) || 0,
  };

  const skillRegex =
/^(.+?)\s+(\d+)\s+(\d+)\s+(\d+)\s+(\d+)\s+(\d+)\s+(\d+)/gm;
  const skills: {
  name: string
  value: number
  base: number
  job: number
  hobby: number
  growth: number
  other: number
}[] = [];
  let match;

  while ((match = skillRegex.exec(text)) !== null) {

  const name = normalizeSkillAlias(match[1].trim())

  const total = Number(match[2])
  const base = Number(match[3])
  const job = Number(match[4])
  const hobby = Number(match[5])
  const other = Number(match[7])

  if (!isNaN(total)) {

    const growth = Math.max(
      0,
      total - (base + job + hobby)
    )

    skills.push({
      name,
      value: total,
      base,
      job,
      hobby,
      growth,
      other
    })

  }

}

let existingChar = await db.characters
  .filter(c => iacharaId && c.iacharaId === iacharaId)
  .first();

if (!existingChar && sheetUrl) {
  existingChar = await db.characters
    .filter(c => c.sheetUrl === sheetUrl)
    .first();
}

const mergedSkills = (() => {

  const map = new Map<string, any>();

  // 既存技能
  existingChar?.skills?.forEach(s => {
    map.set(normalizeSkillName(s.name), { ...s });
  });

  // JSON技能
  skills.forEach(s => {

    const old = map.get(normalizeSkillName(s.name));

    if (old) {

  const base = old.base ?? 0
  const job = old.job ?? 0
  const hobby = old.hobby ?? 0

  const growth = Math.max(
    0,
    s.value - (base + job + hobby)
  )

  map.set(normalizeSkillName(s.name),{
  ...old,
  value:s.value,
  growth
});

}

 else {

      map.set(s.name, {
        name: s.name,
        value: s.value,
        base: 0,
        job: 0,
        hobby: 0,
        growth: 0,
        other: 0
      });

    }

  });

  return Array.from(map.values());

})();

const isUpdate = !!existingChar;
  
  const newChar: Character = {
  id: existingChar?.id ?? crypto.randomUUID(),
  name: name || "不明",
furigana,
  occupation: occupation || "不明",
birthplace: birthplace ,
birthday: birthday,
  gender,
  age,
  height,
  sanCurrent: sanCurrent,
  sanMax: sanMax,
  hp,
  mp,
  status,
  skills,
  imageUrl: imageUrl,
  sheetUrl: sheetUrl,
iacharaId: iacharaId,
  color: extractedColor,   // ←これ追加
createdAt: existingChar?.createdAt ?? Date.now(),
updatedAt: existingChar ? Date.now() : existingChar?.createdAt ?? Date.now(),
};

await db.characters.put(newChar)

if (user) {
  await setDoc(
    doc(dbCloud, "users", user.uid, "characters", newChar.id),
    newChar
  )
}

if (isUpdate) {
  showMessage("キャラクターを更新しました");
} else {
  showMessage("キャラクターを追加しました");
}

  setCharacters(await db.characters.toArray());
setTextInput("");
return;
};


const filteredCharacters = useMemo(() => {
  
  return characters.filter((char) => {
  if (!char.skills) return false;

// 出身地検索
if (
  birthplaceSearch &&
  birthplaceSearch !== "__sort__"
) {

  const place = normalizeText(char.birthplace ?? "");

  const search =
    normalizeText(birthplaceSearch) ||
    normalizeText(birthplaceText);

  if (!place.includes(search)) return false;

}

// その他出身地
if (birthplaceSearch === "__other__") {

  const place = normalizeText(char.birthplace ?? "");

  const isPrefecture = prefectureOrder.some(p =>
    place.includes(normalizeText(p))
  );

  if (isPrefecture || place === "") return false;
}

// 未設定
if (birthplaceSearch === "__none__") {

  if (char.birthplace && char.birthplace.trim() !== "") {
    return false;
  }

}

// 性別
if (genderSearch) {
  if (genderSearch === "男") {
    if (char.gender !== "男") return false;
  } 
  else if (genderSearch === "女") {
    if (char.gender !== "女") return false;
  } 
  else if (genderSearch === "その他") {
    if (
      char.gender === "男" ||
      char.gender === "女" ||
      char.gender === ""
    ) {
      return false;
    }
  } 
  else if (genderSearch === "未設定") {
  if (char.gender && char.gender !== "未設定") return false;
}
}

// 職業（部分一致）
if (
  occupationSearch &&
  !char.occupation.includes(occupationSearch)
) {
  return false;
}

// 年齢以上
if (ageSearch || ageSearchMax) {

  if (!char.age || char.age === 0) return false;

  const min = ageSearch ? Number(ageSearch) : null;
  const max = ageSearchMax ? Number(ageSearchMax) : null;

  if (min !== null && max !== null) {
    if (char.age < Math.min(min,max) || char.age > Math.max(min,max))
      return false;
  }

  else if (min !== null) {
    if (ageMode === "gte" && char.age < min) return false;
    if (ageMode === "lte" && char.age > min) return false;
  }

  else if (max !== null) {
    if (char.age > max) return false;
  }

}

// 身長以上
if (heightSearch) {
  const num = Number(heightSearch);

  if (!char.height || char.height === 0) return false;

  if (heightMode === "gte") {
    if (char.height < num) return false;
  }

  if (heightMode === "lte") {
    if (char.height > num) return false;
}
    }

  /* -----------------
     ステータス検索
  ----------------- */

  const statusMatch = Object.entries(statusSearch).every(
  ([key, value]) => {
    if (!value) return true;

    const num = Number(value);

    if (key === "HP")
      return statusMode === "gte"
        ? char.hp >= num
        : char.hp <= num;

    if (key === "MP")
      return statusMode === "gte"
        ? char.mp >= num
        : char.mp <= num;

    if (key === "SAN")
  return sanMode === "gte"
    ? char.sanCurrent >= num
    : char.sanCurrent <= num;

    return statusMode === "gte"
      ? char.status[key as keyof typeof char.status] >= num
      : char.status[key as keyof typeof char.status] <= num;
  }
);

if (!statusMatch) return false;

// ダメボ検索
if (damageBonusSearch) {

  const db = getDamageBonus(
    char.status.STR,
    char.status.SIZ
  );

  if (db !== damageBonusSearch) return false;
}

  /* -----------------
     技能検索
  ----------------- */

const hasSkillSearch = searchSkill.trim() !== "";
const hasValueSearch = searchValue !== "";

if (!hasSkillSearch && !hasValueSearch) {
  return statusMatch;
}

  const keywords = searchSkill
  .trim()
  .split(/\s+/)
  .map(normalizeSkillName)
  .filter(Boolean);

  const skillMatch =
keywords.length === 0 ||
keywords.every((keyword) =>
  char.skills.some((skill) => {

    const normalized = normalizeSkillName(skill.name)

    if (!normalized.includes(keyword))
      return false;

    const base = getBaseSkillValue(char, skill.name);

return base < 0 || skill.value > base;
  })
);

 const valueMatch =
  !searchValue ||

  (
    keywords.length === 0
      ? char.skills.some((skill) => {
          const base = getBaseSkillValue(char, skill.name);
          return (
            (base < 0 || skill.value > base) &&
            skill.value >= Number(searchValue)
          );
        })
      : keywords.every((keyword) =>
  char.skills.some((skill) => {

    const normalized = normalizeSkillName(skill.name)

    if (!normalized.includes(keyword))
      return false;
            const base = getBaseSkillValue(char, skill.name);

            return (
              (base < 0 || skill.value > base) &&
              skill.value >= Number(searchValue)
            );
          })
        )
  );

  return skillMatch && valueMatch;
});

}, [
  characters,
  searchSkill,
  searchValue,
  genderSearch,
  occupationSearch,

birthplaceSearch,
birthplaceText,

  ageSearch,
ageSearchMax,
  heightSearch,
  ageMode,
  heightMode,
  statusSearch,
  damageBonusSearch,
  statusMode,
sanMode
]);

// ステータス検索時はステータス値順

const sortedCharacters = useMemo(() => {

  return [...filteredCharacters].sort((a, b) => {

    if (searchSkill.trim() !== "" && filteredCharacters.length > 1) {
      const getSkillValue = (char: Character) => {

  const keywords = searchSkill
    .trim()
    .split(/\s+/)
    .map(normalizeSkillName)
    .filter(Boolean);

  if (skillTotalSort) {

    return keywords.reduce((total, keyword) => {

      const skill = char.skills.find(s =>
        normalizeSkillName(s.name).includes(keyword)
      );

      return total + (skill?.value ?? 0);

    }, 0);

  }

  const skill = char.skills.find(s =>
    normalizeSkillName(s.name).includes(keywords[0])
  );

  return skill?.value ?? 0;
};

      if (skillSort === "desc") {
        return getSkillValue(b) - getSkillValue(a);
      } else {
        return getSkillValue(a) - getSkillValue(b);
      }
    }

    // ステータス検索
    const statusKeys = Object.entries(statusSearch)
  .filter(([_, v]) => v !== "")
  .map(([k]) => k);

if (sortMode !== "name" && (statusKeys.length > 0 || statusSearch.SAN)) {

  const key = statusKeys[0] ?? "SAN";

  const getValue = (c: Character) => {
    if (key === "HP") return c.hp ?? 0;
    if (key === "MP") return c.mp ?? 0;
    if (key === "SAN") return c.sanCurrent ?? 0;

    return c.status[key as keyof typeof c.status] ?? 0;
  };

  if (key === "SAN") {
  return sanMode === "gte"
    ? getValue(b) - getValue(a)
    : getValue(a) - getValue(b);
}

return statusMode === "gte"
  ? getValue(b) - getValue(a)
  : getValue(a) - getValue(b);
}

    // 年齢
if (sortMode !== "name" && (ageSearch || ageSearchMax)) {

  if (ageSort === "desc") {
    return (b.age ?? 0) - (a.age ?? 0);
  }

  return (a.age ?? 0) - (b.age ?? 0);

}

    // 身長
    if (sortMode !== "name" && heightSearch) {
  return heightMode === "gte"
    ? (b.height ?? 0) - (a.height ?? 0)
    : (a.height ?? 0) - (b.height ?? 0);
}

// 出身地順
if (sortMode === "birthplace") {

  return getPrefectureIndex(a.birthplace ?? "")
    - getPrefectureIndex(b.birthplace ?? "");

}

// 都道府県順（セレクトから）
if (birthplaceSearch === "__sort__") {

  return getPrefectureIndex(a.birthplace ?? "")
    - getPrefectureIndex(b.birthplace ?? "");

}

    // 名前順
    if (sortMode === "name") {

      const normalizeKana = (s: string) =>
        s
          .replace(/\s/g, "")
          .replace(/[ァ-ヶ]/g, (m) =>
            String.fromCharCode(m.charCodeAt(0) - 0x60)
          );

      const getKana = (c: Character) => {
        if (c.furigana && c.furigana.trim() !== "") {
          return normalizeKana(c.furigana);
        }
        return "んんんん" + normalizeKana(c.name);
      };

      return getKana(a).localeCompare(getKana(b), "ja");
    }

    // 作成順
    if (sortMode === "created") {
      return (b.createdAt ?? 0) - (a.createdAt ?? 0);
    }

    // 更新順
    if (sortMode === "updated") {
      return (b.updatedAt ?? 0) - (a.updatedAt ?? 0);
    }

    return 0;

  });

}, [
  filteredCharacters,
  statusSearch,
  sortMode,
  ageSearch,
  ageSearchMax,
  ageSort,
  heightSearch,
  skillSort,
  skillTotalSort,
  searchSkill
]);

if (authLoading) return null;

return (
<>



{showSettings && (
  <div
    ref={settingsRef}
    style={{
      position: "absolute",
      top: 65,
      right: 0,
      background: "#fff",
      border: "1px solid #ddd",
      borderRadius: 10,
      padding: 12,
      display: "flex",
      flexDirection: "column",
      gap: 8,
      zIndex: 999,
    }}
>


{!user && (
  <>
    <button onClick={loginGoogle}>Googleログイン</button>
    <button onClick={() => setShowLogin(true)}>
ログイン
</button>
    <button onClick={()=>setShowRegister(true)}>
新規登録
</button>
    <button onClick={loginGuest}>ゲスト</button>
  </>
)}

{user && (
  <>
    <div
  style={{
    fontSize: 15,
    fontWeight: 700,
    color: "#333",
    textAlign: "center",
    marginBottom: 2
  }}
>
  ログイン中
</div>

    <button
  onClick={async () => {

    const ok = confirm("ログアウトしますか？");

    if (!ok) return;

    await logout();

  }}
  style={{
    width: "100%",
    padding: "6px 8px",
    borderRadius: 8,
    border: "none",
    background: "#000",
    color: "#fff",
    fontWeight: 600,
    cursor: "pointer",
    whiteSpace: "nowrap"
  }}
>
  ログアウト
</button>

  </>
)}

{showRegister && (
<div
ref={registerRef}
style={{
position:"fixed",
top:0,
left:0,
width:"100%",
height:"100%",
background:"rgba(0,0,0,0.4)",
display:"flex",
alignItems:"center",
justifyContent:"center",
zIndex:2000
}}
>

<div
style={{
background:"#fff",
padding:28,
borderRadius:14,
width:320,
boxShadow:"0 10px 30px rgba(0,0,0,0.2)",
display:"flex",
flexDirection:"column",
gap:14
}}
>

<h3 style={{
margin:0,
fontSize:18,
fontWeight:700,
color:"#000"
}}>
新規登録
</h3>

<input
placeholder="ユーザーID"
value={registerId}
onChange={(e)=>setRegisterId(e.target.value)}
style={{
padding:"10px 12px",
borderRadius:10,
border:"1px solid #ccc",
fontSize:14
}}
/>

<input
type="password"
placeholder="パスワード"
value={registerPass}
onChange={(e)=>setRegisterPass(e.target.value)}
style={{
padding:"10px 12px",
borderRadius:10,
border:"1px solid #ccc",
fontSize:14
}}
/>

<div style={{
display:"flex",
gap:10,
marginTop:4
}}>

<button
onClick={async ()=>{

await createUserWithEmailAndPassword(
auth,
`${registerId}@coc.app`,
registerPass
)

setShowRegister(false)

}}
className="app-button"
style={{flex:1}}
>
登録
</button>

<button
onClick={()=>setShowRegister(false)}
style={{
flex:1,
background:"#eee",
border:"none",
borderRadius:8,
cursor:"pointer",
color:"#000"
}}
>
キャンセル
</button>

</div>

</div>
</div>
)}

  </div>
)}


<div
  style={{
    display: "flex",
    flexDirection: isMobile ? "column" : "row",
    height: "100vh",
  }}
>
  
{isMobile && (
  <div
    style={{
      display: "flex",
      gap: 12,
      padding: "12px 20px",
      borderBottom: "1px solid #ddd",
    }}
  >
    <button
      onClick={() => setActiveTab("search")}
      style={{
        flex: 1,
        padding: "10px 0",
        borderRadius: 12,
        border: "none",
        background:
          activeTab === "search" ? "#111" : "#333",
        color: "#fff",
        fontWeight: 600,
      }}
    >
      🔍 検索
    </button>

    <button
      onClick={() => setActiveTab("list")}
      style={{
        flex: 1,
        padding: "10px 0",
        borderRadius: 12,
        border: "none",
        background:
          activeTab === "list" ? "#111" : "#333",
        color: "#fff",
        fontWeight: 600,
      }}
    >
      📋 一覧
    </button>
  </div>
)}
      {(!isMobile || activeTab === "search") && (
 <LeftPanel
  searchSkill={searchSkill}
  setSearchSkill={setSearchSkill}
  searchValue={searchValue}
  setSearchValue={setSearchValue}

skillTotalSort={skillTotalSort}
setSkillTotalSort={setSkillTotalSort}

birthplaceText={birthplaceText}
setBirthplaceText={setBirthplaceText}

birthplaceSearch={birthplaceSearch}
setBirthplaceSearch={setBirthplaceSearch}

  statusSearch={statusSearch}
  setStatusSearch={setStatusSearch}

  statusMode={statusMode}
  setStatusMode={setStatusMode}

  damageBonusSearch={damageBonusSearch}
  setDamageBonusSearch={setDamageBonusSearch}

  isMobile={isMobile}
  textInput={textInput}
  setTextInput={setTextInput}
  importFromText={importFromText}

  genderSearch={genderSearch}
  setGenderSearch={setGenderSearch}
  occupationSearch={occupationSearch}
  setOccupationSearch={setOccupationSearch}

  ageSearch={ageSearch}
  setAgeSearch={setAgeSearch}
  heightSearch={heightSearch}
  setHeightSearch={setHeightSearch}

ageSearchMax={ageSearchMax}
setAgeSearchMax={setAgeSearchMax}

  ageMode={ageMode}
  setAgeMode={setAgeMode}
  heightMode={heightMode}
  setHeightMode={setHeightMode}

ageSort={ageSort}
setAgeSort={setAgeSort}
  sanMode={sanMode}
  setSanMode={setSanMode}

skillSort={skillSort}
setSkillSort={setSkillSort}
/>
)}

{(!isMobile || activeTab === "list") && (
  <div
    style={{
      flex: 1,
      padding: 20,
      overflowY: "auto",
      boxSizing: "border-box",
position: "relative"
    }}
  >

<div
  style={{
    position: "absolute",
    top: 20,
    right: 20,
    zIndex: 1000
  }}
>

<button
  onClick={() => setShowSettings(!showSettings)}
  style={{
    fontSize: 20,
    padding: "6px 10px",
    borderRadius: 8,
    background: "#000",
    color: "#fff",
  }}
>
⚙
</button>
</div>



    <Routes>
  <Route
    path="/"
    element={
      user ? (
        <CharacterList
          characters={sortedCharacters}
          deleteCharacter={deleteCharacter}
          totalCharacters={characters.length}
          showDetails={showDetails}
          setShowDetails={setShowDetails}
          searchSkill={searchSkill}
          showMatchedOnly={showMatchedOnly}
          setShowMatchedOnly={setShowMatchedOnly}
          statusSearch={statusSearch}
          columns={columns}
          setColumns={setColumns}
          sortMode={sortMode}
          setSortMode={setSortMode}
        />
      ) : (
        <div style={{ padding: 40 }}>
          ログインしてください
        </div>
      )
    }
  />

  <Route
    path="/character/:id"
    element={<CharacterDetail />}
  />
</Routes>
</div>
)}
</div>

{showLogin && (
<div
style={{
position:"fixed",
top:0,
left:0,
width:"100%",
height:"100%",
background:"rgba(0,0,0,0.4)",
display:"flex",
alignItems:"center",
justifyContent:"center",
zIndex:2000
}}
>

<div
style={{
background:"#fff",
padding:28,
borderRadius:14,
width:320,
boxShadow:"0 10px 30px rgba(0,0,0,0.2)",
display:"flex",
flexDirection:"column",
gap:14
}}
>

<h3 style={{
margin:0,
fontSize:18,
fontWeight:700,
color:"#000"
}}>
ログイン
</h3>

<input
placeholder="ユーザーID"
value={loginId}
onChange={(e)=>setLoginId(e.target.value)}
style={{
padding:"10px 12px",
borderRadius:10,
border:"1px solid #ccc",
fontSize:14
}}
/>

<input
type="password"
placeholder="パスワード"
value={loginPass}
onChange={(e)=>setLoginPass(e.target.value)}
style={{
padding:"10px 12px",
borderRadius:10,
border:"1px solid #ccc",
fontSize:14
}}
/>

<div style={{
display:"flex",
gap:10,
marginTop:4
}}>

<button
onClick={async ()=>{

await signInWithEmailAndPassword(
auth,
`${loginId}@coc.app`,
loginPass
)

setShowLogin(false)

}}
className="app-button"
style={{flex:1}}
>
ログイン
</button>

<button
onClick={()=>setShowLogin(false)}
style={{
flex:1,
background:"#eee",
border:"none",
borderRadius:8,
cursor:"pointer",
color:"#000"
}}
>
キャンセル
</button>

</div>

</div>
</div>
)}
</>
);
}
const cardStyle: React.CSSProperties = {
  border: "1px solid #ddd",
  borderRadius: 14,
  padding: 16,
};

export default App;
/* =========================
   LeftPanel
========================= */
type LeftPanelProps = {
  searchSkill: string;
  setSearchSkill: React.Dispatch<React.SetStateAction<string>>;

skillTotalSort: boolean;
setSkillTotalSort: React.Dispatch<React.SetStateAction<boolean>>;

ageSearchMax: string;
setAgeSearchMax: React.Dispatch<React.SetStateAction<string>>;

ageSort: "desc" | "asc";
setAgeSort: React.Dispatch<React.SetStateAction<"desc" | "asc">>;

skillSort: string;
setSkillSort: React.Dispatch<React.SetStateAction<string>>;

  searchValue: string;
  setSearchValue: React.Dispatch<React.SetStateAction<string>>;

  statusSearch: any;
  setStatusSearch: React.Dispatch<React.SetStateAction<any>>;

birthplaceText: string;

setBirthplaceText: React.Dispatch<
  React.SetStateAction<string>
>;

statusMode: "gte" | "lte";
setStatusMode: React.Dispatch<
  React.SetStateAction<"gte" | "lte">
>;

birthplaceSearch: string;

setBirthplaceSearch: React.Dispatch<
React.SetStateAction<string>
>;

  isMobile: boolean;

  textInput: string;

  setTextInput: React.Dispatch<React.SetStateAction<string>>;

  importFromText: () => void;

  genderSearch: string;

  setGenderSearch: React.Dispatch<React.SetStateAction<string>>;

  occupationSearch: string;

  setOccupationSearch: React.Dispatch<React.SetStateAction<string>>;
  ageSearch: string;
  setAgeSearch: React.Dispatch<React.SetStateAction<string>>;
  heightSearch: string;
  setHeightSearch: React.Dispatch<React.SetStateAction<string>>;
  ageMode: "gte" | "lte";
  setAgeMode: React.Dispatch<React.SetStateAction<"gte" | "lte">>;
  heightMode: "gte" | "lte";
  setHeightMode: React.Dispatch<React.SetStateAction<"gte" | "lte">>;
sortMode: "updated" | "created" | "name";
setSortMode: React.Dispatch<
  React.SetStateAction<"updated" | "created" | "name">
>;

damageBonusSearch: string;
setDamageBonusSearch: React.Dispatch<
  React.SetStateAction<string>
>;

sanMode: "gte" | "lte";
setSanMode: React.Dispatch<
  React.SetStateAction<"gte" | "lte">
>;
};
const sectionTitleStyle: React.CSSProperties = {
  fontSize: 18,
  fontWeight: 700,
  margin: 0,
  marginBottom: 16,
};
function LeftPanel({
  searchSkill,
  setSearchSkill,
  searchValue,
  setSearchValue,

skillSort,
setSkillSort,

  birthplaceSearch,
  setBirthplaceSearch,
birthplaceText,
setBirthplaceText,

skillTotalSort,
setSkillTotalSort,

  statusSearch,
  setStatusSearch,
statusMode,
setStatusMode,
  isMobile,
  textInput,
  setTextInput,
  importFromText,
  genderSearch,
  setGenderSearch,
  occupationSearch,
  setOccupationSearch,
  ageSearch,
  setAgeSearch,

ageSearchMax,
setAgeSearchMax,

ageSort,
setAgeSort,

  heightSearch,
  setHeightSearch,
  ageMode,
  setAgeMode,
  heightMode,
  setHeightMode,
sanMode,
setSanMode,
damageBonusSearch,
setDamageBonusSearch,
}: LeftPanelProps) {

const [isClearHover, setIsClearHover] = useState(false);
const [openSections, setOpenSections] =
  useState<string[]>([
    "status",
    "skill",
    "basic",
  ]);

const toggleSection = (key: string) => {
  setOpenSections((prev) =>
    prev.includes(key)
      ? prev.filter((k) => k !== key)
      : [...prev, key]
  );
};
      return (
  <div
  style={{
    width: isMobile ? "100%" : 350,
    padding: 20,
    borderRight: "1px solid #ddd",
    overflowY: "auto",
scrollbarGutter: "stable",
    boxSizing: "border-box",
  }}
>

<div style={{ ...cardStyle, marginTop: 12 }}>

{/* =======================
    ステータス検索
======================= */}

<div
  onClick={() => toggleSection("status")}
  style={{
    display: "flex",
    alignItems: "center",
    gap: 8,
    cursor: "pointer",
  }}
>
<span style={{ fontSize: 16 }}>
{openSections.includes("status") ? "▼" : "▶"}
</span>

<h3 style={{ margin: 0 }}>
能力値検索
</h3>
</div>

<div
  className={`accordion-content ${
    openSections.includes("status")
      ? "accordion-open"
      : "accordion-closed"
  }`}
>

<div
style={{
display:"grid",
gridTemplateColumns:"repeat(3,1fr)",
rowGap:6,
columnGap:12
}}
>

{[
"STR","CON","POW",
"DEX","APP","SIZ",
"INT","EDU","DB",
"SAN","HP","MP"
].map((key)=>(

<div
key={key}
style={{
display:"flex",
flexDirection:"column",
alignItems:"center",
gap:4
}}
>

<span style={{fontSize:13,fontWeight:600}}>
{key}
</span>

{key==="DB" ? (

<select
value={damageBonusSearch}
onChange={(e)=>setDamageBonusSearch(e.target.value)}
style={{
width:70,
padding:"4px 0",
fontSize:15,
textAlign:"center",
borderRadius:8,
border:"1px solid #ccc"
}}
>
<option value="">DB</option>
<option value="-1d6">-1d6</option>
<option value="-1d4">-1d4</option>
<option value="0">0</option>
<option value="1d4">1d4</option>
<option value="1d6">1d6</option>
</select>

) : key==="SAN" ? (

<>
<input
type="number"
value={statusSearch.SAN}
onChange={(e)=>
setStatusSearch({
...statusSearch,
SAN:e.target.value
})
}
style={{
width:70,
height:30,
fontSize:15,
textAlign:"center",
borderRadius:"8px 8px 0 0",
border:"1px solid #ccc",
borderBottom:"none",
boxSizing:"border-box"
}}
/>

<button
onClick={()=>setSanMode(sanMode==="gte"?"lte":"gte")}
style={{
width:70,
height:30,
borderRadius:"0 0 8px 8px",
border:"1px solid #ccc",
borderTop:"none",
marginTop:-4,
background:"#000",
color:"#fff",
display:"flex",
alignItems:"center",
justifyContent:"center",
whiteSpace:"nowrap",
boxSizing:"border-box",
cursor:"pointer",
transform:"none",
transition:"none"
}}
>
{sanMode==="gte"?"以上":"以下"}
</button>
</>

) : (

<input
type="number"
value={statusSearch[key]}
onChange={(e)=>
setStatusSearch({
...statusSearch,
[key]:e.target.value
})
}
style={{
width:70,
padding:"4px 0",
fontSize:15,
textAlign:"center",
borderRadius:8,
border:"1px solid #ccc"
}}
/>

)}

</div>
))}
</div>

<button
onClick={()=>{
setStatusSearch({
STR:"",
CON:"",
POW:"",
DEX:"",
APP:"",
SIZ:"",
INT:"",
EDU:"",
SAN:"",
HP:"",
MP:""
})
setDamageBonusSearch("")
}}
style={{
gridColumn:"2 / 4",
width:"65%",
marginTop:-20,
height:34,
borderRadius:8,
background:"#000",
color:"#fff",
display:"flex",
alignItems:"center",
justifyContent:"center",
justifySelf:"end"
}}
>
リセット
</button>

</div>
</div>

<div
  style={{
    ...cardStyle,
    marginTop: 8,
    paddingBottom: openSections.includes("skill") ? 16 : 0,
  }}
>

  <div
  onClick={() => toggleSection("skill")}
  style={{
    display: "flex",
    alignItems: "center",
    gap: 8,
    cursor: "pointer",
  }}
>
  <span>
    {openSections.includes("skill") ? "▼" : "▶"}
  </span>
  <h3 style={{ margin: 0 }}>技能検索</h3>
</div>

<div
  className={`accordion-content ${
    openSections.includes("skill")
      ? "accordion-open"
      : "accordion-closed"
  }`}
  style={{
    display: "flex",
    flexDirection: "column",
    gap: 14,   // ← ここが間隔
    marginTop: 12,
  }}
>
    {/* 技能名 + 技能値 */}
<div
style={{
display:"flex",
gap:10,
alignItems:"center"
}}
>

<input
type="text"
placeholder="例：目星 聞き耳"
value={searchSkill}
onChange={(e)=>setSearchSkill(e.target.value)}
style={{
width:"70%",
padding:"8px 10px",
fontSize:15,
borderRadius:10,
border:"1px solid #ccc"
}}
/>
    
      {/* 技能値 */}
      
<input
  type="text"
  inputMode="numeric"
  placeholder="技能値"
  value={searchValue}
  onChange={(e) => {
    const raw = e.target.value;

    if (raw === "") {
      setSearchValue("");
      return;
    }

    const normalized = raw.replace(/[０-９]/g, (s) =>
      String.fromCharCode(s.charCodeAt(0) - 65248)
    );

    const num = Number(normalized);

    if (!isNaN(num)) {
      setSearchValue(
        Math.min(100, Math.max(0, num)).toString()
      );
    }
  }}
  style={{
    width: 50,
    padding: "8px 10px",
    fontSize: 15,
    textAlign: "center",
    borderRadius: 10,
    border: "1px solid #ccc",
  }}
/>

</div>

<div
style={{
display:"flex",
gap:10,
alignItems:"center"
}}
>

{/* 並び順 */}

<select
  value={skillSort}
  onChange={(e)=>setSkillSort(e.target.value)}
  style={{
    width:120,
    height:35,
    fontSize:14,
    borderRadius:10,
    border:"1px solid #ccc"
  }}
>

  <option value="desc">高い順</option>
  <option value="asc">低い順</option>
</select>

<button
onClick={()=>setSkillTotalSort(!skillTotalSort)}
style={{
width:80,
height:35,
borderRadius:10,
background:"#000",
color:"#fff",
display:"flex",
flexDirection:"column",
alignItems:"center",
justifyContent:"center",
lineHeight:1,
fontSize:12,
whiteSpace:"nowrap"
}}
>
<span>合計ソート</span>
<span>{skillTotalSort ? "ON" : "OFF"}</span>
</button>

      {/* リセット */}
<button
  onClick={() => {
    setSearchSkill("");
    setSearchValue("");
  }}
  style={{
    width:80,
    height:35,
    borderRadius:10,
    background:"#000",
    color:"#fff",
    display:"flex",
    alignItems:"center",
    justifyContent:"center",
    fontSize:13,
    whiteSpace:"nowrap"
  }}
>
  リセット
</button>
</div>
</div>
</div>

{/* =======================
    プロフィール検索
======================= */}
<div style={{ ...cardStyle, marginTop: 8 }}>
  <div
    onClick={() => toggleSection("profile")}
    style={{
      display: "flex",
      alignItems: "center",
      gap: 8,
      cursor: "pointer",
    }}
  >
    <span>
      {openSections.includes("profile") ? "▼" : "▶"}
    </span>
    <h3 style={{ margin: 0 }}>プロフィール検索</h3>
  </div>

  <div
    className={`accordion-content ${
      openSections.includes("profile")
        ? "accordion-open"
        : "accordion-closed"
    }`}
  >
    {/* 職業 + 性別 */}
    <div
      style={{
        display: "flex",
        gap: 12,
        marginTop: 12,
      }}
    >
      <input
        type="text"
        placeholder="職業(部分検索可)"
        value={occupationSearch}
        onChange={(e) => setOccupationSearch(e.target.value)}
        style={{
          width: "75%",
          padding: "8px 10px",
          fontSize: 15,
          borderRadius: 10,
          border: "1px solid #ccc",
          boxSizing: "border-box",
        }}
      />

      <select
        value={genderSearch}
        onChange={(e) => setGenderSearch(e.target.value)}
        style={{
          width: "40%",
          padding: "8px 10px",
          borderRadius: 10,
          border: "1px solid #ccc",
          boxSizing: "border-box",
        }}
      >
        <option value="">性別</option>
        <option value="男">男</option>
        <option value="女">女</option>
        <option value="その他">その他</option>
        <option value="未設定">未設定</option>
      </select>
    </div>

    {/* 年齢 */}
    
<div
style={{
display:"flex",
gap:6,
width:"100%",
marginTop:15,
alignItems:"flex-start"
}}
>

<div
style={{
display:"flex",
flexDirection:"column",
alignItems:"center"
}}
>

<input
type="text"
placeholder="年齢"
value={ageSearch}
onChange={(e)=>setAgeSearch(e.target.value)}
style={{
width:70,
padding:"10px 10px",
fontSize:15,
textAlign:"center",
borderRadius:"8px 8px 0 0",
border:"1px solid #ccc",
borderBottom:"none",
boxSizing:"border-box"
}}
/>

<button
onClick={()=>setAgeMode(ageMode==="gte"?"lte":"gte")}
style={{
width:70,
height:30,
borderRadius:"0 0 8px 8px",
border:"1px solid #ccc",
borderTop:"none",
marginTop:-4,
background:"#000",
color:"#fff",
display:"flex",
alignItems:"center",
justifyContent:"center",
boxSizing:"border-box",
whiteSpace:"nowrap"
}}
>
{ageMode==="gte"?"以上":"以下"}
</button>

</div>

<span>～</span>

<input
type="text"
placeholder="上限"
value={ageSearchMax}
onChange={(e)=>setAgeSearchMax(e.target.value)}
style={{
width:46,
padding:"8px 10px",
fontSize:15,
textAlign:"center",
borderRadius:10,
border:"1px solid #ccc"
}}
/>

<select
value={ageSort}
onChange={(e)=>setAgeSort(e.target.value as "desc"|"asc")}
style={{
width:90,
height:35,
borderRadius:10,
border:"1px solid #ccc"
}}
>
<option value="desc">高い順</option>
<option value="asc">低い順</option>
</select>

</div>

<button
onClick={()=>{
setOccupationSearch("")
setGenderSearch("")
setAgeSearch("")
setAgeSearchMax("")
}}
style={{
width:80,
height:35,
borderRadius:10,
background:"#000",
color:"#fff",
display:"flex",
alignItems:"center",
justifyContent:"center",
whiteSpace:"nowrap",
marginLeft:"auto",
marginTop:-15
}}
>
リセット
</button>

    </div>
  </div>



{/* =======================
    キャラ情報検索
======================= */}
<div style={{ ...cardStyle, marginTop: 8 }}>
  <div
    onClick={() => toggleSection("character")}
    style={{
      display: "flex",
      alignItems: "center",
      gap: 8,
      cursor: "pointer",
    }}
  >
    <span>
      {openSections.includes("character") ? "▼" : "▶"}
    </span>
    <h3 style={{ margin: 0 }}>キャラ情報検索</h3>
  </div>

  <div
    className={`accordion-content ${
      openSections.includes("character")
        ? "accordion-open"
        : "accordion-closed"
    }`}
  >

{/* 出身地 */}
<div
style={{
display:"flex",
gap:12,
marginTop:8
}}
>

<select
value={birthplaceSearch}
onChange={(e)=>setBirthplaceSearch(e.target.value)}
style={{
width:"50%",
padding:"8px 10px",
borderRadius:10,
border:"1px solid #ccc",
boxSizing:"border-box"
}}
>

<option value="">都道府県</option>

{prefectures.map(p=>(
<option key={p} value={p}>
{p}
</option>
))}

<option value="__other__">その他</option>
<option value="__none__">未設定</option>
<option value="__sort__">出身地順</option>

</select>

<input
type="text"
placeholder="出身地検索"
value={birthplaceText}
onChange={(e)=>setBirthplaceText(e.target.value)}
style={{
width:"60%",
padding:"8px 10px",
fontSize:15,
borderRadius:10,
border:"1px solid #ccc"
}}
/>

</div>

{/* 身長 */}
<div
style={{
display:"flex",
gap:6,
marginTop:12,
alignItems: "center"
}}
>

<input
  type="text"
  placeholder="身長"
  value={heightSearch}
  onChange={(e)=>setHeightSearch(e.target.value)}
  style={{
    width: "20%",
    padding: "8px 10px",
    fontSize: 15,
textAlign: "center",
    borderRadius: 10,
    border: "1px solid #ccc"
  }}
/>

<button
onClick={() =>
setHeightMode(heightMode==="gte"?"lte":"gte")
}
style={{
width: 70,
height: 35,
fontSize: 14,
borderRadius: 10,
background: "#000",
color:"#fff",
display: "flex",
alignItems: "center",
justifyContent: "center",
whiteSpace: "nowrap"
}}
>
{heightMode==="gte"?"以上":"以下"}
</button>

<button
  onClick={() => {
    setBirthplaceSearch("");
    setBirthplaceText("");
    setHeightSearch("");
  }}
  style={{
    width: 80,
    height: 35,
    fontSize: 14,
    borderRadius: 10,
    background: "#000",
    color:"#fff",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    marginLeft: 10,
    whiteSpace: "nowrap"
  }}
>
  リセット
</button>

</div>

  </div>
</div>

{/* いあきゃらテキスト追加 */}
<div style={{ ...cardStyle, marginTop: 8 }}>
  <div
  onClick={() => toggleSection("import")}
  style={{
    display: "flex",
    alignItems: "center",
    gap: 8,
    cursor: "pointer",
  }}
>
  <span>
    {openSections.includes("import") ? "▼" : "▶"}
  </span>
  <h3 style={{ margin: 0 }}>
    キャラクターを追加
  </h3>
</div>

<div
  className={`accordion-content ${
    openSections.includes("import")
      ? "accordion-open"
      : "accordion-closed"
  }`}
>

<textarea
placeholder="いあきゃら / キャラ保管所URL / JSON を貼り付け"
value={textInput}
onChange={(e) => setTextInput(e.target.value)}

  style={{
    width: "100%",
    height: 120,
    marginTop: 10,
    padding: 10,
    borderRadius: 10,
    border: "1px solid #ccc",
    fontSize: 14,
    resize: "vertical",
    boxSizing: "border-box",
  }}
/>

<button
onClick={importFromText}
style={{
marginTop: 10,
width: "100%",
padding: 8,
borderRadius: 8,
background: "#000",
color: "#fff",
display: "flex",
alignItems: "center",
justifyContent: "center"
}}
>
テキストから追加
</button>

</div>
</div>
</div>

);
}
/* =========================
   CharacterList
========================= */
const CharacterList = React.memo(function CharacterList({
  characters,
totalCharacters,
  deleteCharacter,
  showDetails,
  setShowDetails,
  searchSkill,
  showMatchedOnly,
  setShowMatchedOnly,
  statusSearch,
  columns,
  setColumns,
sortMode,
  setSortMode,
}: {

  characters: Character[];
  deleteCharacter: (id: string) => void;
totalCharacters: number;
  showDetails: boolean;
  setShowDetails: React.Dispatch<React.SetStateAction<boolean>>;
  searchSkill: string;
  showMatchedOnly: boolean;
  setShowMatchedOnly: React.Dispatch<React.SetStateAction<boolean>>;
  statusSearch: any;

sortMode: "updated" | "created" | "name";
setSortMode: React.Dispatch<
  React.SetStateAction<"updated" | "created" | "name">
>;

  columns: 1 | 2 | 4 | "auto";
  setColumns: React.Dispatch<
    React.SetStateAction<1 | 2 | 4 | "auto">
  >;


}) {
  const navigate = useNavigate();

  return (
    <div>
      <h2 style={{ marginBottom: 10 }}>
  登録キャラ一覧（{characters.length} / {totalCharacters}）
</h2>

     <div style={{ marginBottom: 10 }}>

<select
  value={sortMode}
  onChange={(e) =>
    setSortMode(
      e.target.value as "updated" | "created" | "name"
    )
  }
  style={{
    height: 36,
    borderRadius: 8,
    padding: "0 8px",
    marginBottom: 8
  }}
>
  <option value="updated">更新順</option>
  <option value="created">作成順</option>
  <option value="name">名前順</option>

</select>

  {/* 上段 */}
  <div style={{ display: "flex", gap: 10, marginBottom: 6 }}>

    <button
  onClick={() => setShowDetails(!showDetails)}
  style={{
    height: 36,
    fontSize: 15,
    borderRadius: 8,
    background: "#000",
    color: "#fff",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    whiteSpace: "nowrap"
  }}
>
  {showDetails
    ? "プロフィール表示中"
    : "プロフィール非表示中"}
</button>

    <button
  onClick={() => setShowMatchedOnly(!showMatchedOnly)}
  style={{
    height: 36,
    fontSize: 15,
    borderRadius: 8,
    padding: "0 14px",
    background: "#000",
    color: "#fff",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    whiteSpace: "nowrap"
  }}
>
  {showMatchedOnly
    ? "全技能非表示中"
    : "全技能表示中"}
</button>

  </div>

  {/* 下段（列表示） */}
  <div style={{ display: "flex", gap: 6 }}>
    <span style={{ fontSize: 14, alignSelf: "center" }}>
      表示列：
    </span>

    {[1,2,4,"auto"].map((c) => (
      <button
        key={String(c)}
        onClick={() => setColumns(c as any)}
        style={{
          padding: "4px 10px",
          borderRadius: 6,
          fontSize: 13,
          border: "none",
          cursor: "pointer",
          background: columns === c ? "#000" : "#eee",
          color: columns === c ? "#fff" : "#000",
        }}
      >
        {c === "auto" ? "auto" : c}
      </button>
    ))}
  </div>

</div>
<div
  style={{
    display: "grid",
    gridTemplateColumns:
      columns === "auto"
        ? "repeat(auto-fill, minmax(420px, 1fr))"
        : `repeat(${columns}, 1fr)`,
    gap: 12,
  }}
>
      {characters.map((char) => {

  const statusTotal =
    char.status.STR +
    char.status.CON +
    char.status.POW +
    char.status.DEX +
    char.status.APP +
    char.status.SIZ +
    char.status.INT +
    char.status.EDU;

  const keywords = searchSkill
  .trim()
  .split(/\s+/)
  .map(normalizeSkillName)
  .filter(Boolean);
  const matchedSkills =
  keywords.length === 0
    ? []
    : keywords
        .flatMap((keyword) =>
          char.skills.filter((skill) =>
            normalizeSkillName(skill.name).includes(keyword)
          )
        )
          .filter(
            (skill): skill is { name: string; value: number } =>
              !!skill
          );

  const grownSkills = char.skills.filter((skill) => {
  const base = getBaseSkillValue(char, skill.name);

  if (base < 0) return true;

  return skill.value > base;
});


  const matchedStatus = Object.entries(statusSearch)
    .filter(([_, value]) => value !== "")
    .map(([key]) => key);

  return (
    <div
      key={char.id}
      style={{
        position: "relative",
        display: "flex",
        alignItems: "center",
        border: "1px solid #dcdcdc",
        borderLeft: `4px solid ${char.color ?? "#dcdcdc"}`,
        padding: 16,
        borderRadius: 12,
        boxShadow: "0 2px 8px rgba(0,0,0,0.05)",
      }}
    >
            {/* アイコン */}
            <img
              src={
                char.imageUrl
                  ? char.imageUrl
                  : "https://placehold.jp/100x100.png"
              }
              alt="icon"
              onClick={() =>
                navigate(`/character/${char.id}`)
              }
              style={{
                width: 70,
                height: 70,
                borderRadius: "50%",
                marginRight: 16,
                cursor: "pointer",
                objectFit: "cover",
                flexShrink: 0,
              }}
            />

            {/* 情報エリア */}
            <div style={{ flex: 1 }}>
              <div
  style={{
    display: "flex",
    alignItems: "center",
    gap: 8,
  }}
>
 <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
  <strong style={{ fontSize: 18 }}>
  {char.name}
  {char.furigana && ` (${char.furigana})`}
</strong>

  {char.source === "json" && (
  <span
    style={{
      fontSize: 14,
      color: "#f5a623",
    }}
  >
    ⚡
  </span>
)}
</div>

{char.sheetUrl && (
  <button
  onClick={(e) => {
    e.stopPropagation();
    window.open(char.sheetUrl, "_blank");
  }}
  style={{
    fontSize: 12,
    padding: "4px 8px",
    borderRadius: 6,
    background: "#000",
    color: "#fff",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    whiteSpace: "nowrap"
  }}
>
  {char.sheetUrl.includes("charasheet")
    ? "キャラ保管所へ"
    : "いあきゃらへ"}
</button>
)}
  
</div>

{char.occupation && (
  <div
    style={{
      fontSize: 16,
      opacity: 0.75,
      marginTop: 2,
    }}
  >
    職業：{char.occupation}　SAN: {char.sanCurrent}
  </div>
)}

{showDetails && (
  <div
    style={{
      marginTop: 6,
      fontSize: 15,
      opacity: 0.85,
    }}
  >
    {char.gender && `${char.gender} `}
{char.age ? `${char.age}歳 ` : ""}
{char.height ? `${char.height}cm ` : ""}
{char.birthday ? `🎂${char.birthday}` : ""}
  </div>
)}

{!showMatchedOnly && (
  <div
    style={{
      marginTop: 6,
      fontSize: 14,
      opacity: 0.8,
    }}
  >
    能力値合計：{statusTotal}
  </div>
)}

{/* ステータス表示 */}

    {(!showMatchedOnly || matchedStatus.length > 0) && (
  <div
    style={{
      marginTop: 6,
      display: "flex",
      flexWrap: "wrap",
      gap: 8,
    }}
  >
    {[
  ["STR", char.status.STR],
  ["CON", char.status.CON],
  ["POW", char.status.POW],
  ["DEX", char.status.DEX],
  ["APP", char.status.APP],
  ["SIZ", char.status.SIZ],
  ["INT", char.status.INT],
  ["EDU", char.status.EDU],
  ["HP", char.hp],
  ["MP", char.mp],
  ["SAN", char.sanCurrent],
]
.filter(([key]) => {
  if (!showMatchedOnly) return true;        // 全表示
  if (matchedStatus.length === 0) return true; // 検索なし
  return matchedStatus.includes(key);       // 検索ヒット
})
.map(([key, value]) => {

  const isMatched = matchedStatus.includes(key);

  return isMatched ? (
    <span key={key} style={{ fontSize: 16 }}>
      ➤ {key} {value}
    </span>
  ) : (
    <span
      key={key}
      style={{
        background: "#1a1a1a",
        padding: "6px 14px",
        borderRadius: 8,
        fontSize: 14,
        color: "#fff",
      }}
    >
      {key} {value}
    </span>
  );
})}
  </div>
)}

              {/* 技能表示 */}
              {(searchSkill.trim() !== "" || !showMatchedOnly) && (
                <div
  style={{
    marginTop: 6,
    display: "flex",
    flexWrap: "wrap",
    gap: 8,
  }}
>
{[
  ...(
    !showMatchedOnly
      ? [
          { name: "幸運", value: (char.status.POW ?? 0) * 5 },
          { name: "アイデア", value: (char.status.INT ?? 0) * 5 },
          { name: "知識", value: (char.status.EDU ?? 0) * 5 },
        ]
      : []
  ),
  ...(showMatchedOnly ? matchedSkills : grownSkills)
].map((skill) => {

  const isMatched =
    matchedSkills.some((m) => m.name === skill.name);

  return isMatched ? (
    <span
      key={skill.name}
      style={{ fontSize: 16 }}
    >
      ➤ {skill.name} {skill.value}
    </span>
  ) : (
    <span
      key={skill.name}
      style={{
        background: "#1a1a1a",
        padding: "6px 14px",
        borderRadius: 8,
        fontSize: 14,
        color: "#fff",
      }}
    >
      {skill.name} {skill.value}
    </span>
  );
})}
</div>
              )}
              
            </div>

            {/* 削除ボタン */}
<button
  onClick={() => {
    const ok = window.confirm(
      `このキャラを削除しますか？`
    );
    if (ok) {
      deleteCharacter(char.id);
    }
  }}
  style={{
    marginLeft: 12,
    alignSelf: "center",
    background: "#000",
    color: "#fff",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    padding: "6px 12px",
    borderRadius: 8,
    whiteSpace: "nowrap"
  }}
>
  削除
</button>
          </div>
        );
      })}
    </div>
  </div>
    );
});
/* =========================
   CharacterDetail
========================= */

const skillCategories = {

"戦闘技能":[
"回避","キック","組み付き","こぶし","頭突き","投擲",
"マーシャルアーツ","拳銃","サブマシンガン",
"ショットガン","マシンガン","ライフル"
],

"探索技能":[
"応急手当","鍵開け","隠す","隠れる","聞き耳","忍び歩き",
"写真術","精神分析","追跡","登攀","図書館","目星"
],

"行動技能":[
"運転","機械修理","重機械操作","乗馬","水泳",
"製作","操縦","跳躍","電気修理","ナビゲート","変装"
],

"交渉技能":[
"言いくるめ","信用","説得","値切り","母国語"
],

"知識技能":[
"医学","オカルト","化学","クトゥルフ神話","芸術",
"経理","考古学","コンピューター","心理学","人類学",
"生物学","地質学","電子工学","天文学","博物学",
"物理学","法律","薬学","歴史"
],

};

function CharacterDetail() {

const skillNames = [
"回避","キック","組み付き","こぶし","頭突き","投擲",
"マーシャルアーツ","拳銃","サブマシンガン","ショットガン","マシンガン","ライフル",
"応急手当","鍵開け","隠す","隠れる","聞き耳","忍び歩き",
"写真術","精神分析","追跡","登攀","図書館","目星",
"運転","機械修理","重機械操作","乗馬","水泳","製作",
"操縦","跳躍","電気修理","ナビゲート","変装",
"言いくるめ","信用","説得","値切り","母国語",
"医学","オカルト","化学","クトゥルフ神話","芸術",
"経理","考古学","コンピューター","心理学","人類学",
"生物学","地質学","電子工学","天文学","博物学",
"物理学","法律","薬学","歴史"
];

const { id } = useParams();
const navigate = useNavigate();
const [char, setChar] =
useState<Character | null>(null);

useEffect(() => {
db.characters.get(id!).then(setChar);
}, [id]);

if (!char) return <div>見つかりません</div>;

const skillCategories = {
  戦闘技能:["回避","キック","組み付き","こぶし","頭突き","投擲","マーシャルアーツ","拳銃","サブマシンガン","ショットガン","マシンガン","ライフル"],
  探索技能:["応急手当","鍵開け","隠す","隠れる","聞き耳","忍び歩き","写真術","精神分析","追跡","登攀","図書館","目星"],
  行動技能:["運転","機械修理","重機械操作","乗馬","水泳","製作","操縦","跳躍","電気修理","ナビゲート","変装"],
  交渉技能:["言いくるめ","信用","説得","値切り","母国語"],
  知識技能:["医学","オカルト","化学","クトゥルフ神話","芸術","経理","考古学","コンピューター","心理学","人類学","生物学","地質学","電子工学","天文学","博物学","物理学","法律","薬学","歴史"]
};

const categorizedSkills = Object.values(skillCategories).flat();

const otherSkills = char.skills.filter(
  s => !categorizedSkills.includes(normalizeSkillName(s.name))
);

return (

<div style={{
padding:20,
maxWidth:900,
margin:"0 auto"
}}>

<button
onClick={()=>navigate("/")}>
← 一覧へ戻る
</button>

{/* アイコン */}
<div style={{
textAlign:"center",
marginTop:20
}}>

<img
src={
char.imageUrl
? char.imageUrl
: "https://placehold.jp/200x200.png"
}
style={{
width:200,
height:200,
objectFit:"cover",
borderRadius:12
}}
/>

</div>

{/* 名前 */}
<div style={{
textAlign:"center",
marginTop:10
}}>

{char.furigana && (

<div style={{
fontSize:14,
opacity:0.7
}}>
{char.furigana}
</div>

)}

<div style={{
fontSize:32,
fontWeight:700
}}>
{char.name}
</div>

</div>

<hr style={{
margin:"20px 0"
}}/>

{/* プロフィール */}

<div style={{
display:"flex",
flexWrap:"wrap",
gap:20,
fontSize:18
}}>

{char.occupation && (
<div>職業 {char.occupation}</div>
)}

{char.age>0 && (
<div>年齢 {char.age}</div>
)}

{char.gender && (
<div>性別 {char.gender}</div>
)}

{char.height>0 && (
<div>身長 {char.height}</div>
)}

{char.birthplace && (
<div>出身 {char.birthplace}</div>
)}

{char.birthday && (
<div>誕生日 {char.birthday}</div>
)}

</div>

<hr style={{ margin:"20px 0" }} />

{/* 能力値 */}

<div
style={{
display:"grid",
gridTemplateColumns:"repeat(4,1fr)",
gap:20,
textAlign:"center",
fontSize:18
}}
>

<div>
<div>STR</div>
<div style={{fontSize:22,fontWeight:700}}>
{char.status.STR}
</div>
</div>

<div>
<div>CON</div>
<div style={{fontSize:22,fontWeight:700}}>
{char.status.CON}
</div>
</div>

<div>
<div>POW</div>
<div style={{fontSize:22,fontWeight:700}}>
{char.status.POW}
</div>
</div>

<div>
<div>DEX</div>
<div style={{fontSize:22,fontWeight:700}}>
{char.status.DEX}
</div>
</div>

<div>
<div>APP</div>
<div style={{fontSize:22,fontWeight:700}}>
{char.status.APP}
</div>
</div>

<div>
<div>SIZ</div>
<div style={{fontSize:22,fontWeight:700}}>
{char.status.SIZ}
</div>
</div>

<div>
<div>INT</div>
<div style={{fontSize:22,fontWeight:700}}>
{char.status.INT}
</div>
</div>

<div>
<div>EDU</div>
<div style={{fontSize:22,fontWeight:700}}>
{char.status.EDU}
</div>
</div>

</div>

<hr style={{ margin:"20px 0" }} />

{/* ステータス */}

<div
style={{
display:"flex",
flexWrap:"wrap",
gap:12,
fontSize:18
}}
>

<div
style={{
border:"1px solid #ccc",
padding:"6px 12px",
borderRadius:8
}}
>
SAN {char.sanCurrent}/{char.sanMax}
</div>

<div
style={{
border:"1px solid #ccc",
padding:"6px 12px",
borderRadius:8
}}
>
HP {char.hp}
</div>

<div
style={{
border:"1px solid #ccc",
padding:"6px 12px",
borderRadius:8
}}
>
MP {char.mp}
</div>

<div
style={{
border:"1px solid #ccc",
padding:"6px 12px",
borderRadius:8
}}
>
DB {getDamageBonus(char.status.STR,char.status.SIZ)}
</div>

<div
style={{
border:"1px solid #ccc",
padding:"6px 12px",
borderRadius:8
}}
>
アイデア {(char.status.INT ?? 0)*5}
</div>

<div
style={{
border:"1px solid #ccc",
padding:"6px 12px",
borderRadius:8
}}
>
幸運 {(char.status.POW ?? 0)*5}
</div>

<div
style={{
border:"1px solid #ccc",
padding:"6px 12px",
borderRadius:8
}}
>
知識 {(char.status.EDU ?? 0)*5}
</div>

</div>

<hr style={{ margin:"20px 0" }} />
{/* 技能一覧 */}

<h3 style={{marginBottom:10}}>技能</h3>

<div
style={{
display:"flex",
gap:12,
fontWeight:700,
marginBottom:8
}}
>

<div style={{width:140}}>技能</div>
<div style={{width:40,textAlign:"center"}}>初期</div>
<div style={{width:40,textAlign:"center"}}>職</div>
<div style={{width:40,textAlign:"center"}}>興</div>
<div style={{width:40,textAlign:"center"}}>成</div>
<div style={{width:40,textAlign:"center"}}>他</div>
<div style={{width:50,textAlign:"center"}}>合計</div>

</div>

{Object.entries(skillCategories).map(([category, skills]) => (


<div key={category} style={{marginBottom:20}}>

<h4 style={{marginBottom:8}}>
{category}
</h4>

<div
style={{
display:"grid",
gridTemplateColumns:"1fr",
gap:8
}}
>

{skills.map((skillName)=>{

const skill = char.skills.find(s=>s.name===skillName)

const base = getBaseSkillValue(char,skillName)

const value = skill?.value ?? base

const isGrowth = value > base

return(

<div
key={skillName}
style={{
display:"flex",
alignItems:"center",
flexWrap:"wrap",
gap:12,
padding:"6px 10px",
borderRadius:8,
background:isGrowth?"#f2f2f2":"#1a1a1a",
color:isGrowth?"#000":"#fff",
fontSize:14
}}
>

<div style={{width:140}}>
{skillName}
</div>

<div style={{width:40,textAlign:"center"}}>
{skill?.base ?? base}
</div>

<div style={{width:40,textAlign:"center"}}>
{skill?.job ?? 0}
</div>

<div style={{width:40,textAlign:"center"}}>
{skill?.hobby ?? 0}
</div>

<div style={{width:40,textAlign:"center"}}>
{skill?.growth ?? 0}
</div>

<div style={{width:40,textAlign:"center"}}>
{skill?.other ?? 0}
</div>

<div style={{width:50,textAlign:"center"}}>
{value}
</div>

</div>

)

})}

</div>

</div>

))}

</div>

);
}