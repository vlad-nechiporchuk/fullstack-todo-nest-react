import { DefaultNamingStrategy, type Table } from "typeorm"

/** Primary keys are named `pk_<table>` instead of TypeORM's hashed default, like the other constraints. */
export class NamingStrategy extends DefaultNamingStrategy {
  override primaryKeyName(tableOrName: Table | string): string {
    return `pk_${this.getTableName(tableOrName)}`
  }
}
