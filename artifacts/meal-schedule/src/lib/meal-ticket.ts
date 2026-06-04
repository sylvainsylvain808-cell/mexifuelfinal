const PREP_FULL_TIME_STAFF = [
  // Prep full-time staff do not use meal tickets.
  // Add exact names here, for example: "김민서"
] as const;

const prepFullTimeStaff = new Set<string>(PREP_FULL_TIME_STAFF);

export function canUseMealTicket(name: string): boolean {
  return !prepFullTimeStaff.has(name);
}

export function getMealTicketUsers(users: string[]): string[] {
  return users.filter(canUseMealTicket);
}

