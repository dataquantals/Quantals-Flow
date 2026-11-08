import { handleApi } from '../server/index.js';

export const config = {
  api: { bodyParser: false }
};

export default async function handler(req, res) {
  return handleApi(req, res);
}
