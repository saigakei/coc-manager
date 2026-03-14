import Dexie from "dexie";
import type { Table } from "dexie";

export interface Skill {
  name: string;
  value: number;
}

export type Character = {

  id: string
  name: string

  birthplace?: string   // ←これ

}

export interface Character {
  id: string;
  name: string;
  furigana?: string;
  gender: string;
  occupation: string;
  age?: number;
  height?: number;
birthday?: string;
iacharaId?: string;
iacharaId?: string;
imageUrl?: string;
color?: string;

  hp: number;
  mp: number;
  sanMax: number
sanCurrent: number

  status: {
    STR: number;
    CON: number;
    POW: number;
    DEX: number;
    APP: number;
    SIZ: number;
    INT: number;
    EDU: number;
  };

  skills: Skill[];   // ← これ追加
  imageIds: string[];

createdAt?: number
updatedAt?: number
source?: string

}

export interface ImageData {
  id: string;
  characterId: string;
  blob: Blob;

createdAt: number;
updatedAt: number;
}

class CocDatabase extends Dexie {
  characters!: Table<Character, string>;
  images!: Table<ImageData, string>;

  constructor() {
    super("CocDatabase");

    this.version(2).stores({
  characters: "id, name, furigana, createdAt, updatedAt",
  images: "id, characterId",
});

this.characters.hook("creating", (primKey, obj) => {
  const now = Date.now();
  obj.createdAt = now;
  obj.updatedAt = now;
});

this.characters.hook("updating", (mods) => {
  mods.updatedAt = Date.now();
});

  }
}

export const db = new CocDatabase();