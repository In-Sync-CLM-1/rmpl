import { useState, useCallback } from "react";

export interface FormDialogState<T> {
  isOpen: boolean;
  isEditing: boolean;
  selectedItem: T | null;
}

export interface UseFormDialogOptions<T> {
  onSubmit: (data: T, isEditing: boolean) => Promise<void>;
  onSuccess?: () => void;
  transformForEdit?: (item: T) => any;
}

export function useFormDialog<T extends { id?: string }>(
  options: UseFormDialogOptions<T>
) {
  const { onSubmit, onSuccess, transformForEdit } = options;

  const [dialogState, setDialogState] = useState<FormDialogState<T>>({
    isOpen: false,
    isEditing: false,
    selectedItem: null,
  });

  const [isSaving, setIsSaving] = useState(false);

  const openDialog = useCallback((item?: T) => {
    setDialogState({
      isOpen: true,
      isEditing: !!item,
      selectedItem: item || null,
    });
  }, []);

  const closeDialog = useCallback(() => {
    setDialogState({
      isOpen: false,
      isEditing: false,
      selectedItem: null,
    });
    setIsSaving(false);
  }, []);

  const handleSubmit = useCallback(
    async (data: T) => {
      try {
        setIsSaving(true);
        await onSubmit(data, dialogState.isEditing);
        closeDialog();
        onSuccess?.();
      } catch (error) {
        console.error("Form submission error:", error);
        throw error;
      } finally {
        setIsSaving(false);
      }
    },
    [onSubmit, dialogState.isEditing, closeDialog, onSuccess]
  );

  const getInitialValues = useCallback(() => {
    if (dialogState.selectedItem && transformForEdit) {
      return transformForEdit(dialogState.selectedItem);
    }
    return dialogState.selectedItem;
  }, [dialogState.selectedItem, transformForEdit]);

  return {
    isOpen: dialogState.isOpen,
    isEditing: dialogState.isEditing,
    selectedItem: dialogState.selectedItem,
    isSaving,
    openDialog,
    closeDialog,
    handleSubmit,
    getInitialValues,
  };
}
