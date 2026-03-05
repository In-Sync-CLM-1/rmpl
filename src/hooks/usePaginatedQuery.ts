import { useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { toast } from "sonner";
import { PostgrestFilterBuilder } from "@supabase/postgrest-js";

interface UsePaginatedQueryOptions<T> {
  queryKey: string[];
  queryFn: (from: number, to: number) => Promise<{ data: T[] | null; count: number | null; error: any }>;
  orderBy?: { column: string; ascending?: boolean };
  initialItemsPerPage?: number;
  onError?: (error: Error) => void;
}

export function usePaginatedQuery<T>({
  queryKey,
  queryFn,
  initialItemsPerPage = 10,
  onError,
}: UsePaginatedQueryOptions<T>) {
  const [currentPage, setCurrentPage] = useState(1);
  const [itemsPerPage, setItemsPerPage] = useState(initialItemsPerPage);

  const { data, isLoading, error, refetch } = useQuery({
    queryKey: [...queryKey, currentPage, itemsPerPage],
    queryFn: async () => {
      const from = (currentPage - 1) * itemsPerPage;
      const to = from + itemsPerPage - 1;

      const { data, count, error } = await queryFn(from, to);

      if (error) {
        console.error("Error fetching data:", error);
        throw error;
      }

      return {
        data: (data || []) as T[],
        totalCount: count || 0,
        totalPages: Math.ceil((count || 0) / itemsPerPage),
      };
    },
  });

  // Handle errors
  if (error && onError) {
    onError(error as Error);
  } else if (error) {
    toast.error("Failed to fetch data");
  }

  const handlePageChange = (page: number) => {
    setCurrentPage(page);
  };

  const handleItemsPerPageChange = (items: number) => {
    setItemsPerPage(items);
    setCurrentPage(1); // Reset to first page
  };

  return {
    data: data?.data || [],
    totalCount: data?.totalCount || 0,
    totalPages: data?.totalPages || 0,
    currentPage,
    itemsPerPage,
    isLoading,
    error,
    refetch,
    handlePageChange,
    handleItemsPerPageChange,
  };
}
