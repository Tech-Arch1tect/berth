type ClassValue = string | false | null | undefined | ClassValue[];

const flatten = (values: ClassValue[]): string[] => {
  const result: string[] = [];
  for (const value of values) {
    if (!value) {
      continue;
    }
    if (Array.isArray(value)) {
      result.push(...flatten(value));
      continue;
    }
    result.push(value);
  }
  return result;
};

export const cn = (...classes: ClassValue[]): string => {
  return flatten(classes).join(' ');
};
