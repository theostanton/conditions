import axios, {AxiosHeaders} from "axios";

export function generateHeaders(token:string):AxiosHeaders{
    const headers: AxiosHeaders = new AxiosHeaders();
    headers.set('Content-Type', 'application/xml');
    headers.set('apikey', process.env.TOKEN as string);
    return headers
}