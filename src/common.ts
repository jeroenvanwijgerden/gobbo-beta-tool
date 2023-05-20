export const EOF = 'end of file'

export type Position = [number, number, number]; // [l, c, i]

export const EXCEPTION_NAME = 'GobboError';
export enum ERROR_TYPE {
  Parse,
  Reify,
  Read
}