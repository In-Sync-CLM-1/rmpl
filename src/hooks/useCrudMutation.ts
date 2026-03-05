import { useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";

interface UseCrudMutationOptions<T> {
  queryKey: string[];
  createFn: (data: any) => Promise<T>;
  updateFn: (id: string, data: any) => Promise<T>;
  deleteFn: (id: string) => Promise<void>;
  successMessages?: {
    create?: string;
    update?: string;
    delete?: string;
  };
  errorMessages?: {
    create?: string;
    update?: string;
    delete?: string;
  };
}

export function useCrudMutation<T>({
  queryKey,
  createFn,
  updateFn,
  deleteFn,
  successMessages = {},
  errorMessages = {},
}: UseCrudMutationOptions<T>) {
  const queryClient = useQueryClient();

  const createMutation = useMutation({
    mutationFn: createFn,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey });
      toast.success(successMessages.create || "Created successfully");
    },
    onError: (error: Error) => {
      console.error("Error creating:", error);
      toast.error(errorMessages.create || "Failed to create");
    },
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, data }: { id: string; data: any }) => updateFn(id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey });
      toast.success(successMessages.update || "Updated successfully");
    },
    onError: (error: Error) => {
      console.error("Error updating:", error);
      toast.error(errorMessages.update || "Failed to update");
    },
  });

  const deleteMutation = useMutation({
    mutationFn: deleteFn,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey });
      toast.success(successMessages.delete || "Deleted successfully");
    },
    onError: (error: Error) => {
      console.error("Error deleting:", error);
      toast.error(errorMessages.delete || "Failed to delete");
    },
  });

  return {
    create: createMutation.mutateAsync,
    update: updateMutation.mutateAsync,
    delete: deleteMutation.mutateAsync,
    isCreating: createMutation.isPending,
    isUpdating: updateMutation.isPending,
    isDeleting: deleteMutation.isPending,
  };
}
