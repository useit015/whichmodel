export function getBootstrapMessage(): string {
  return "whichmodel phase 0 foundation ready";
}

if (import.meta.url === `file://${process.argv[1]}`) {
  console.log(getBootstrapMessage());
}
