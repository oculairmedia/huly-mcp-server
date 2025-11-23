import { promises as fs } from 'fs';
import { stat, readdir } from 'fs/promises';

export async function exists(path) {
  try {
    await stat(path);
    return true;
  } catch (error) {
    if (error.code === 'ENOENT') {
      return false;
    }
    throw error;
  }
}

export async function readDir(path) {
  return await readdir(path);
}

export async function statFile(path) {
  return await stat(path);
}

export async function readFile(path, encoding = 'utf8') {
  return await fs.readFile(path, encoding);
}

export { fs };
