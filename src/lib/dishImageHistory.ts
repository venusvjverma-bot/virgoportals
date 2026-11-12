export interface DishImageGenerationRow {
  id: string;
  targetType: 'dish' | 'combo';
  targetName: string;
  status: 'pending' | 'succeeded' | 'failed';
  generationId: string | null;
  creditDeducted: number;
  refunded: boolean;
  errorMessage: string | null;
  createdAt: string;
  completedAt: string | null;
}

type DishImageGenerationRowData = {
  id: string;
  target_type: string;
  target_name: string;
  status: string;
  generation_id: string | null;
  credit_deducted: string | number;
  refunded: boolean;
  error_message: string | null;
  created_at: string;
  completed_at: string | null;
};

export type { DishImageGenerationRowData };
