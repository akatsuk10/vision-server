import { PrismaClient as PostgresPrismaClient } from "../../generated/postgres";
import { PrismaClient as MongoPrismaClient } from "../../generated/mongodb";

// Initialize PostgreSQL client
const postgresPrisma = new PostgresPrismaClient();

// Initialize MongoDB client
const mongoPrisma = new MongoPrismaClient();

// Export both clients
export { postgresPrisma, mongoPrisma };

// For backward compatibility, export postgresPrisma as default
export default postgresPrisma;
