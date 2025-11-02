import {connect} from "ts-postgres";

export default async function () {
  return await connect({
    host: "34.77.203.241",
    user: "postgres",
    password: "password",
    database: "database",
  });
}