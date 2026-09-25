'use client';

import { SCENARIOS_KEY } from '@/lib/api/keys';
import useSWR from 'swr';
import { ApiScenario, listScenarios } from '../api';

export function useScenarios(): {
    scenarios: ApiScenario[];
    isLoading: boolean;
    error: unknown;
} {
    const { data, error, isLoading } = useSWR(SCENARIOS_KEY, listScenarios);
    return { scenarios: data ?? [], isLoading, error };
}
