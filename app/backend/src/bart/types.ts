/** The value domain `bart-parser` fixes (`Bart.g4` deviation 8): strings, numbers, booleans,
 *  and collections thereof. Dates, nested objects and null are not expressible. */
export type BartScalar = string | number | boolean;
export type BartValue = BartScalar | BartScalar[];
export type BartAttrs = Record<string, BartValue>;
