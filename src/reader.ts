import { path as p } from "../deps.ts";
import { ERROR_TYPE, EXCEPTION_NAME } from "./common.ts";

export type Read = (
  current_file_path: string,
  path: string,
) => { absolute_path: string; content: string };

export const dud_read: Read = () => {
  return { absolute_path: "", content: "" };
};

export interface Read_info {
  absolute_path : string,
  content: string
}

export interface Read_error_info {
  path: string,
  message: string
}

export function create_file_read(root: string): Read {
  if (!p.isAbsolute(root)) {
    throw `Root must be absolute; ${root} is not.`;
  }

  const decoder = new TextDecoder("utf-8");

  return (current_file_path: string, path: string) : Read_info => {
    const path_to_read = p.isAbsolute(path)
      ? p.join(root, path)
      : (path == ""
        ? current_file_path
        : p.join(p.dirname(current_file_path), path));

    try {
      return {
        absolute_path: path_to_read,
        content: decoder.decode(Deno.readFileSync(path_to_read)),
      };
    } catch(e) {
      const info : Read_error_info = {
        path: path_to_read,
        message: e.message
      }

      throw {
        name: EXCEPTION_NAME,
        type: ERROR_TYPE.Read,
        info
      }
    }
    
  };
}
