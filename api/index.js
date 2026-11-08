import { handleApi } from '../server/index.js';

export default async function handler(req, res) {
  return handleApi(req, res);
}
