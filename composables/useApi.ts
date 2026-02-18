export function useApi() {
  async function api<T>(url: string, options?: Parameters<typeof $fetch>[1]): Promise<T> {
    return $fetch(url, {
      ...options,
      onResponseError({ response }) {
        const message = response._data?.error || '请求失败';
        console.error(`API Error [${response.status}]: ${message}`);
      },
    }) as Promise<T>;
  }

  return { api };
}
