import bcrypt from "bcryptjs";
import { createInterface } from "node:readline/promises";
import { stdin as input, stdout as output } from "node:process";

const password = process.argv[2];

async function readPassword() {
  if (password) {
    return password;
  }

  const readline = createInterface({
    input,
    output
  });

  const answer = await readline.question("Admin password to hash: ");
  readline.close();

  return answer;
}

const plainTextPassword = await readPassword();
const hash = await bcrypt.hash(plainTextPassword, 12);

console.log(hash);
