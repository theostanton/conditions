import {Request, Response} from "express";
import {google} from "googleapis";

const sqlAdmin = google.sqladmin("v1beta4");

const setup = async () => {
  const auth = new google.auth.GoogleAuth({scopes: []});
  const authClient = await auth.getClient();
  google.options({auth: authClient});
}

export const HTTPFunction = async (req: Request, res: Response) => {
  console.log(req);
  res.send({hello: "World"});
};