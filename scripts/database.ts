import {connect} from "ts-postgres";

export default async function () {
  return await connect({
    host: "35.185.31.59",
    user: "postgres",
    password: "password",
    database: "database",
  });
}