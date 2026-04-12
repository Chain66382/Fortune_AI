import { FileRepository } from '@/models/repositories/fileRepository';
import type { OrderIntentRecord } from '@/types/consultation';

export class OrderIntentRepository extends FileRepository<OrderIntentRecord> {
  constructor() {
    super('order-intents.json');
  }
}
