import {connect} from "ts-postgres";

export default async function () {
  return await connect({
    host: process.env.PGHOST || "34.77.203.241",
    user: process.env.PGUSER || "postgres",
    password: process.env.PGPASSWORD || "password",
    database: process.env.PGDATABASE || "database",
  });
}