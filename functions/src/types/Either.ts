export type Success<T> = [T, null]
export type Error = [null, string]

export type Either<T> = Success<T> | Error