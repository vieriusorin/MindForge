/** MF-0059 (Q3): the join card's notice for a group that follows a path. */
export function joinNotice(pathName: string): string {
  return `This group follows the ${pathName} path. Joining starts it for you.`;
}

/** MF-0059: the create form's notice when the Path kind is chosen. */
export function createNotice(pathName: string): string {
  return `This group follows the ${pathName} path. Creating it starts the path for you, and joining starts it for each member.`;
}
