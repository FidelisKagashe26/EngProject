import { randomUUID } from "crypto";

export const makeId = (prefix: string): string => `${prefix}-${randomUUID().split("-")[0]}`;
