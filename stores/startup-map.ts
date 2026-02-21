import { defineStore } from 'pinia';
import { createSkillLearningStore } from '~/composables/skill-learning';
import type { SmProduct, ProductFormData } from '~/tools/startup-map/types';

// ===== Store 1: Skill learning (via factory) =====
export const useStartupMapSkillStore = createSkillLearningStore('startup-map');

// ===== Store 2: Product management (independent) =====
export const useStartupMapProductStore = defineStore('startup-map-products', () => {
  const activeProduct = ref<SmProduct | null>(null);
  const productLoading = ref(false);
  const productSaving = ref(false);
  const products = ref<SmProduct[]>([]);
  const productsLoading = ref(false);

  async function loadActiveProduct() {
    productLoading.value = true;
    try {
      activeProduct.value = await $fetch<SmProduct>('/api/startup-map/products/active');
    } catch {
      activeProduct.value = null;
    } finally {
      productLoading.value = false;
    }
  }

  async function createProduct(data: ProductFormData) {
    productSaving.value = true;
    try {
      const product = await $fetch<SmProduct>('/api/startup-map/products', {
        method: 'POST',
        body: data,
      });
      activeProduct.value = product;
    } finally {
      productSaving.value = false;
    }
  }

  async function updateProduct(id: number, data: ProductFormData) {
    productSaving.value = true;
    try {
      const product = await $fetch<SmProduct>(`/api/startup-map/products/${id}`, {
        method: 'PUT',
        body: data,
      });
      activeProduct.value = product;
    } finally {
      productSaving.value = false;
    }
  }

  async function loadProducts() {
    productsLoading.value = true;
    try {
      products.value = await $fetch<SmProduct[]>('/api/startup-map/products');
    } catch {
      products.value = [];
    } finally {
      productsLoading.value = false;
    }
  }

  async function deleteProduct(id: number) {
    await $fetch(`/api/startup-map/products/${id}`, { method: 'DELETE' });
    products.value = products.value.filter(p => p.id !== id);
  }

  async function activateProduct(id: number) {
    const product = await $fetch<SmProduct>(`/api/startup-map/products/${id}/activate`, {
      method: 'PATCH',
    });
    activeProduct.value = product;
    products.value = products.value.map(p => ({
      ...p,
      isActive: p.id === id,
    }));
  }

  return {
    activeProduct, productLoading, productSaving,
    products, productsLoading,
    loadActiveProduct, createProduct, updateProduct,
    loadProducts, deleteProduct, activateProduct,
  };
});
