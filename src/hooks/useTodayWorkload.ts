import { useState, useEffect, useCallback } from "react";
import { RevisionApiService } from "../services/revisionApiService";
import type { TodayWorkloadData } from "../domain/revision/RevisionQueueTypes";

export interface UseTodayWorkloadResult {
    workload: TodayWorkloadData | null;
    loading: boolean;
    error: string | null;
    isAuthError: boolean;
    refetch: () => Promise<void>;
}

export function useTodayWorkload(): UseTodayWorkloadResult {
    const [workload, setWorkload] = useState<TodayWorkloadData | null>(null);
    const [loading, setLoading] = useState<boolean>(true);
    const [error, setError] = useState<string | null>(null);
    const [isAuthError, setIsAuthError] = useState<boolean>(false);

    const loadData = useCallback(async () => {
        setLoading(true);
        setError(null);
        setIsAuthError(false);

        const response = await RevisionApiService.fetchTodayWorkload();

        if (response.data) {
            setWorkload(response.data);
            setError(null);
            setIsAuthError(false);
        } else {
            setWorkload(null);
            setError(response.error);
            setIsAuthError(response.isAuthError);
        }

        setLoading(false);
    }, []);

    useEffect(() => {
        loadData();
    }, [loadData]);

    return {
        workload,
        loading,
        error,
        isAuthError,
        refetch: loadData
    };
}
