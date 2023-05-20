import { Node } from "../reify.ts";
import { romans } from "../../deps.ts";

export enum Type {
  Decimal,
  Alpha_Lower,
  Alpha_Upper,
  Roman_Lower,
  Roman_Upper,
}

export type Number = [number, Type];

export interface Numbering {
  group?: string;
  numbers: Number[];
}

export class Module {
  numberings: Map<Node, Numbering> = new Map();
}

function to_alpha(number: number, lower_case: boolean = false): string {
  const offset = lower_case ? 32 : 0;

  let result = "";

  while (number > 0) {
    const remainder = (number - 1) % 26;
    result = String.fromCharCode(65 + offset + remainder) + result;
    number = Math.floor((number - 1) / 26);
  }

  return result;
}

export function number_to_string(number: Number): string {
  const [num, type] = number;

  switch (type) {
    case Type.Decimal:
      return `${num}`;
    case Type.Alpha_Lower:
      return to_alpha(num, true);
    case Type.Alpha_Upper:
      return to_alpha(num);
    case Type.Roman_Lower:
      return romans.romanize(num).toLowerCase();
    case Type.Roman_Upper:
      return romans.romanize(num);
  }
}

export function numbers_to_string(numbers: Number[]): string {
  return numbers.map(number_to_string).join(".");
}
