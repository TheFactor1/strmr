import React, { useState, useCallback, useMemo } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  StatusBar,
} from 'react-native';
import { useNavigation, useFocusEffect, NavigationProp } from '@react-navigation/native';
import { MaterialIcons } from '@expo/vector-icons';
import { useTheme } from '../contexts/ThemeContext';
import { useCollections } from '../hooks/useCollections';
import { stremioService } from '../services/stremioService';
import { mmkvStorage } from '../services/mmkvStorage';
import { catalogOrderService, CatalogOrderService } from '../services/catalogOrderService';
import ScreenHeader from '../components/common/ScreenHeader';
import LoadingSpinner from '../components/common/LoadingSpinner';
import { RootStackParamList } from '../navigation/AppNavigator';

interface OrderItem {
  key: string;
  label: string;
  subtitle: string;
  isCollection: boolean;
}

const CATALOG_SETTINGS_KEY = 'catalog_settings';

const CatalogOrderScreen = () => {
  const navigation = useNavigation<NavigationProp<RootStackParamList>>();
  const { currentTheme } = useTheme();
  const colors = currentTheme.colors;
  const { collections, enabledMap: collectionEnabledMap } = useCollections();

  const [orderedKeys, setOrderedKeys] = useState<string[]>([]);
  const [catalogItems, setCatalogItems] = useState<OrderItem[]>([]);
  const [loading, setLoading] = useState(true);

  // Build collection items from hook
  const collectionItems = useMemo(() => {
    const items: OrderItem[] = [];
    for (const collection of collections) {
      if (collectionEnabledMap[collection.id] === false) continue;
      items.push({
        key: CatalogOrderService.collectionKey(collection.id),
        label: collection.title,
        subtitle: `${collection.folders.length} folder${collection.folders.length !== 1 ? 's' : ''}`,
        isCollection: true,
      });
    }
    return items;
  }, [collections]);

  // Build the full item map
  const itemMap = useMemo(() => {
    const map = new Map<string, OrderItem>();
    for (const item of collectionItems) map.set(item.key, item);
    for (const item of catalogItems) map.set(item.key, item);
    return map;
  }, [collectionItems, catalogItems]);

  // Load catalog metadata from installed addons (same filtering as HomeScreen)
  const loadCatalogs = useCallback(async () => {
    try {
      const addons = await stremioService.getInstalledAddonsAsync();
      const savedSettingsJson = await mmkvStorage.getItem(CATALOG_SETTINGS_KEY);
      const catalogSettings: Record<string, boolean> = savedSettingsJson ? JSON.parse(savedSettingsJson) : {};

      const items: OrderItem[] = [];
      const seen = new Set<string>();

      for (const addon of addons) {
        if (!addon.catalogs) continue;
        const addonUsesShowInHome = addon.catalogs.some((c: any) => c.showInHome === true);

        for (const catalog of addon.catalogs) {
          // Skip search catalogs
          if (
            (catalog.id && catalog.id.startsWith('search.')) ||
            (catalog.type && catalog.type.startsWith('search'))
          ) continue;

          // Skip catalogs with required extras
          const requiredExtras = (catalog.extra || []).filter((e: any) => e.isRequired);
          if (requiredExtras.length > 0) continue;

          // Respect showInHome flag
          if (addonUsesShowInHome && !(catalog as any).showInHome) continue;

          // Respect user enable/disable setting
          const settingKey = `${addon.id}:${catalog.type}:${catalog.id}`;
          const isEnabled = catalogSettings[settingKey] ?? true;
          if (!isEnabled) continue;

          // Deduplicate
          const key = CatalogOrderService.catalogKey(addon.id, catalog.type, catalog.id);
          if (seen.has(key)) continue;
          seen.add(key);

          items.push({
            key,
            label: catalog.name || catalog.id,
            subtitle: `${addon.name || addon.id} · ${catalog.type}`,
            isCollection: false,
          });
        }
      }

      setCatalogItems(items);
    } catch {
      // silent fail
    }
  }, []);

  // Load everything on focus
  useFocusEffect(
    useCallback(() => {
      setLoading(true);
      Promise.all([
        loadCatalogs(),
        catalogOrderService.getOrder(),
      ]).then(([_, savedOrder]) => {
        // itemMap might not be updated yet, so we'll set keys and let the
        // ordered list rebuild via the items memo below
        setOrderedKeys(savedOrder);
        setLoading(false);
      });
    }, [loadCatalogs])
  );

  // Merge saved order with available items
  const items = useMemo(() => {
    const allItems = [...collectionItems, ...catalogItems];
    const allMap = new Map<string, OrderItem>();
    for (const item of allItems) allMap.set(item.key, item);

    if (orderedKeys.length === 0) return allItems;

    const result: OrderItem[] = [];
    const seen = new Set<string>();

    // First: items in saved order
    for (const key of orderedKeys) {
      const item = allMap.get(key);
      if (item && !seen.has(key)) {
        result.push(item);
        seen.add(key);
      }
    }
    // Then: any new items not in saved order
    for (const item of allItems) {
      if (!seen.has(item.key)) {
        result.push(item);
      }
    }
    return result;
  }, [orderedKeys, collectionItems, catalogItems]);

  const handleMoveUp = useCallback((index: number) => {
    if (index <= 0) return;
    const currentKeys = items.map(i => i.key);
    [currentKeys[index - 1], currentKeys[index]] = [currentKeys[index], currentKeys[index - 1]];
    setOrderedKeys(currentKeys);
    catalogOrderService.saveOrder(currentKeys);
  }, [items]);

  const handleMoveDown = useCallback((index: number) => {
    if (index >= items.length - 1) return;
    const currentKeys = items.map(i => i.key);
    [currentKeys[index], currentKeys[index + 1]] = [currentKeys[index + 1], currentKeys[index]];
    setOrderedKeys(currentKeys);
    catalogOrderService.saveOrder(currentKeys);
  }, [items]);

  const handleReset = useCallback(async () => {
    await catalogOrderService.resetOrder();
    setOrderedKeys([]);
  }, []);

  if (loading) {
    return (
      <View style={[styles.container, { backgroundColor: colors.darkBackground }]}>
        <StatusBar barStyle="light-content" backgroundColor="transparent" translucent />
        <ScreenHeader title="Display Order" showBackButton onBackPress={() => navigation.goBack()} />
        <View style={styles.loadingContainer}>
          <LoadingSpinner size="large" />
        </View>
      </View>
    );
  }

  return (
    <View style={[styles.container, { backgroundColor: colors.darkBackground }]}>
      <StatusBar barStyle="light-content" backgroundColor="transparent" translucent />
      <ScreenHeader
        title="Display Order"
        showBackButton
        onBackPress={() => navigation.goBack()}
      />
      <ScrollView contentContainerStyle={styles.scrollContent}>
        <TouchableOpacity
          style={[styles.resetButton, { backgroundColor: colors.elevation3 }]}
          activeOpacity={0.7}
          onPress={handleReset}
        >
          <MaterialIcons name="refresh" size={18} color={colors.text} />
          <Text style={[styles.resetButtonText, { color: colors.text }]}>Reset to Default</Text>
        </TouchableOpacity>

        {items.length === 0 && (
          <View style={styles.emptyContainer}>
            <MaterialIcons name="reorder" size={48} color={colors.textMuted} />
            <Text style={[styles.emptyText, { color: colors.textMuted }]}>
              No catalogs or collections to reorder
            </Text>
          </View>
        )}

        {items.map((item, index) => (
          <View
            key={item.key}
            style={[
              styles.itemCard,
              {
                backgroundColor: colors.elevation1,
                borderColor: item.isCollection ? colors.primary + '40' : colors.border,
              },
            ]}
          >
            <View style={styles.itemInfo}>
              <MaterialIcons
                name={item.isCollection ? 'folder' : 'view-list'}
                size={20}
                color={item.isCollection ? colors.primary : colors.textMuted}
              />
              <View style={styles.itemTextContainer}>
                <Text style={[styles.itemLabel, { color: colors.text }]} numberOfLines={1}>
                  {item.label}
                </Text>
                <Text style={[styles.itemSubtitle, { color: colors.textMuted }]} numberOfLines={1}>
                  {item.subtitle}
                </Text>
              </View>
            </View>
            <View style={styles.itemActions}>
              <TouchableOpacity
                onPress={() => handleMoveUp(index)}
                disabled={index === 0}
                style={[styles.iconButton, index === 0 && styles.disabledButton]}
              >
                <MaterialIcons
                  name="arrow-upward"
                  size={20}
                  color={index === 0 ? colors.disabled : colors.text}
                />
              </TouchableOpacity>
              <TouchableOpacity
                onPress={() => handleMoveDown(index)}
                disabled={index === items.length - 1}
                style={[styles.iconButton, index === items.length - 1 && styles.disabledButton]}
              >
                <MaterialIcons
                  name="arrow-downward"
                  size={20}
                  color={index === items.length - 1 ? colors.disabled : colors.text}
                />
              </TouchableOpacity>
            </View>
          </View>
        ))}
      </ScrollView>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  scrollContent: {
    padding: 16,
    paddingBottom: 40,
  },
  resetButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 12,
    borderRadius: 10,
    marginBottom: 16,
    gap: 6,
  },
  resetButtonText: {
    fontSize: 14,
    fontWeight: '500',
  },
  emptyContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 60,
    gap: 12,
  },
  emptyText: {
    fontSize: 15,
  },
  itemCard: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 12,
    borderRadius: 10,
    borderWidth: 1,
    marginBottom: 8,
  },
  itemInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
    gap: 10,
  },
  itemTextContainer: {
    flex: 1,
  },
  itemLabel: {
    fontSize: 15,
    fontWeight: '500',
  },
  itemSubtitle: {
    fontSize: 12,
    marginTop: 2,
  },
  itemActions: {
    flexDirection: 'row',
    gap: 2,
  },
  iconButton: {
    padding: 6,
  },
  disabledButton: {
    opacity: 0.3,
  },
});

export default CatalogOrderScreen;
