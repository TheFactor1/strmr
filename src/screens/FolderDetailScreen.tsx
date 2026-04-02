import React, { useState, useEffect, useCallback, useMemo } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  StatusBar,
  Dimensions,
  FlatList,
  ScrollView,
} from 'react-native';
import { useNavigation, useRoute, NavigationProp } from '@react-navigation/native';
import { MaterialIcons } from '@expo/vector-icons';
import FastImage from '@d11/react-native-fast-image';
import { useTheme } from '../contexts/ThemeContext';
import { Collection, CollectionFolder, CollectionCatalogSource } from '../types/collections';
import { collectionsService } from '../services/collectionsService';
import { stremioService } from '../services/stremioService';
import { StreamingContent } from '../services/catalogService';
import ScreenHeader from '../components/common/ScreenHeader';
import LoadingSpinner from '../components/common/LoadingSpinner';
import { RootStackParamList } from '../navigation/AppNavigator';

const { width: screenWidth } = Dimensions.get('window');
const ANDROID_STATUSBAR_HEIGHT = StatusBar.currentHeight || 0;

const NUM_COLUMNS = screenWidth >= 1024 ? 5 : screenWidth >= 768 ? 4 : 3;
const ITEM_SPACING = 8;
const HORIZONTAL_PADDING = 16;
const ITEM_WIDTH = (screenWidth - HORIZONTAL_PADDING * 2 - ITEM_SPACING * (NUM_COLUMNS - 1)) / NUM_COLUMNS;
const ROW_ITEM_WIDTH = screenWidth * 0.28;

interface TabData {
  label: string;
  typeLabel: string;
  items: StreamingContent[];
  addonBaseUrl: string;
  isLoading: boolean;
  isAllTab: boolean;
}

function roundRobinMerge(lists: StreamingContent[][]): StreamingContent[] {
  const result: StreamingContent[] = [];
  const seen = new Set<string>();
  const maxSize = Math.max(...lists.map(l => l.length), 0);
  for (let i = 0; i < maxSize; i++) {
    for (const list of lists) {
      const item = list[i];
      if (item && !seen.has(item.id)) {
        seen.add(item.id);
        result.push(item);
      }
    }
  }
  return result;
}

const FolderDetailScreen = () => {
  const navigation = useNavigation<NavigationProp<RootStackParamList>>();
  const route = useRoute();
  const { currentTheme } = useTheme();
  const colors = currentTheme.colors;

  const { collectionId, folderId } = route.params as { collectionId: string; folderId: string };

  const [folder, setFolder] = useState<CollectionFolder | null>(null);
  const [viewMode, setViewMode] = useState<'TABBED_GRID' | 'ROWS'>('TABBED_GRID');
  const [selectedTabIndex, setSelectedTabIndex] = useState(0);
  const [tabs, setTabs] = useState<TabData[]>([]);
  const [initialLoading, setInitialLoading] = useState(true);

  useEffect(() => {
    loadFolder();
  }, [collectionId, folderId]);

  const loadFolder = async () => {
    const collections = await collectionsService.getCollections();
    const collection = collections.find(c => c.id === collectionId);
    if (!collection) return;
    const f = collection.folders.find(f => f.id === folderId);
    if (!f) return;
    setFolder(f);

    const vm = collection.viewMode;
    setViewMode(vm === 'ROWS' ? 'ROWS' : 'TABBED_GRID');

    const showAll = (collection.showAllTab !== false) && f.catalogSources.length >= 2;
    const addons = await stremioService.getInstalledAddonsAsync();

    // Build source tabs
    const sourceTabs: TabData[] = f.catalogSources.map(source => {
      const addon = addons.find((a: any) => a.id === source.addonId);
      const catalog = addon?.catalogs?.find(
        (c: any) => c.id === source.catalogId && c.type === source.type
      );
      const typeLabel = source.type.charAt(0).toUpperCase() + source.type.slice(1);
      return {
        label: catalog?.name || source.catalogId,
        typeLabel: typeLabel === 'Movie' ? 'Movies' : typeLabel === 'Series' ? 'Series' : typeLabel,
        items: [],
        addonBaseUrl: addon?.transportUrl || '',
        isLoading: true,
        isAllTab: false,
      };
    });

    // Prepend All tab if needed
    const allTabs = showAll
      ? [{ label: 'All', typeLabel: 'Combined', items: [] as StreamingContent[], addonBaseUrl: '', isLoading: true, isAllTab: true }, ...sourceTabs]
      : sourceTabs;

    setTabs(allTabs);
    setInitialLoading(false);

    // Load all catalogs concurrently
    const tabOffset = showAll ? 1 : 0;
    const loadPromises = f.catalogSources.map(async (source, index) => {
      const addon = addons.find((a: any) => a.id === source.addonId);
      if (!addon) return { index: index + tabOffset, items: [] as StreamingContent[] };

      try {
        const metas = await stremioService.getCatalog(addon, source.type, source.catalogId, 1);
        const mapped: StreamingContent[] = (metas || []).map((meta: any) => ({
          id: meta.id,
          type: meta.type,
          name: meta.name,
          poster: meta.poster,
          posterShape: meta.posterShape,
          imdbRating: meta.imdbRating,
          year: meta.year,
          genres: meta.genres,
          description: meta.description,
        }));
        return { index: index + tabOffset, items: mapped };
      } catch {
        return { index: index + tabOffset, items: [] as StreamingContent[] };
      }
    });

    const results = await Promise.all(loadPromises);

    setTabs(prev => {
      const updated = [...prev];
      for (const result of results) {
        if (result.index < updated.length) {
          updated[result.index] = { ...updated[result.index], items: result.items, isLoading: false };
        }
      }
      // Build All tab
      if (showAll && updated.length > 0) {
        const sourceItems = updated.slice(1).map(t => t.items);
        const merged = roundRobinMerge(sourceItems);
        updated[0] = { ...updated[0], items: merged, isLoading: false };
      }
      return updated;
    });
  };

  const handleTabPress = useCallback((index: number) => {
    setSelectedTabIndex(index);
  }, []);

  const handleItemPress = useCallback((id: string, type: string) => {
    navigation.navigate('Metadata', { id, type });
  }, [navigation]);

  const renderGridItem = useCallback(({ item }: { item: StreamingContent }) => (
    <TouchableOpacity
      activeOpacity={0.7}
      onPress={() => handleItemPress(item.id, item.type)}
      style={[styles.gridItem, { width: ITEM_WIDTH }]}
    >
      <FastImage
        source={{ uri: item.poster, priority: FastImage.priority.normal }}
        style={styles.gridPoster}
        resizeMode={FastImage.resizeMode.cover}
      />
      <Text numberOfLines={2} style={[styles.gridTitle, { color: colors.text }]}>
        {item.name}
      </Text>
    </TouchableOpacity>
  ), [handleItemPress, colors.text]);

  const renderRowItem = useCallback(({ item }: { item: StreamingContent }) => (
    <TouchableOpacity
      activeOpacity={0.7}
      onPress={() => handleItemPress(item.id, item.type)}
      style={styles.rowItem}
    >
      <FastImage
        source={{ uri: item.poster, priority: FastImage.priority.normal }}
        style={styles.rowPoster}
        resizeMode={FastImage.resizeMode.cover}
      />
      <Text numberOfLines={2} style={[styles.gridTitle, { color: colors.text }]}>
        {item.name}
      </Text>
    </TouchableOpacity>
  ), [handleItemPress, colors.text]);

  const keyExtractor = useCallback((item: StreamingContent, index: number) => `${item.id}_${index}`, []);

  // Header with emoji support
  const headerTitle = useMemo(() => {
    if (!folder) return '';
    if (folder.coverEmoji) return `${folder.coverEmoji}  ${folder.title}`;
    return folder.title;
  }, [folder]);

  if (!folder || initialLoading) {
    return (
      <View style={[styles.container, { backgroundColor: colors.darkBackground }]}>
        <StatusBar barStyle="light-content" backgroundColor="transparent" translucent />
        <LoadingSpinner size="large" />
      </View>
    );
  }

  const currentTab = tabs[selectedTabIndex];

  if (viewMode === 'ROWS') {
    const sourceTabs = tabs.filter(t => !t.isAllTab);
    return (
      <View style={[styles.container, { backgroundColor: colors.darkBackground }]}>
        <StatusBar barStyle="light-content" backgroundColor="transparent" translucent />
        <ScreenHeader
          title={headerTitle}
          showBackButton
          onBackPress={() => navigation.goBack()}
        />
        <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: 48 }}>
          {sourceTabs.map((tab, idx) => (
            <View key={`row-${idx}-${tab.label}`} style={styles.rowSection}>
              <View style={styles.rowHeader}>
                <Text style={[styles.rowTitle, { color: colors.text }]}>{tab.label}</Text>
                <Text style={[styles.rowType, { color: colors.textMuted }]}>{tab.typeLabel}</Text>
              </View>
              {tab.isLoading ? (
                <View style={styles.rowLoadingContainer}>
                  <LoadingSpinner size="small" />
                </View>
              ) : tab.items.length === 0 ? (
                <Text style={[styles.rowEmptyText, { color: colors.textMuted }]}>No content</Text>
              ) : (
                <FlatList
                  data={tab.items}
                  horizontal
                  showsHorizontalScrollIndicator={false}
                  contentContainerStyle={{ paddingHorizontal: HORIZONTAL_PADDING, gap: 10 }}
                  keyExtractor={(item, i) => `${tab.label}_${item.id}_${i}`}
                  renderItem={renderRowItem}
                />
              )}
            </View>
          ))}
        </ScrollView>
      </View>
    );
  }

  // Tabbed Grid view (default)
  return (
    <View style={[styles.container, { backgroundColor: colors.darkBackground }]}>
      <StatusBar barStyle="light-content" backgroundColor="transparent" translucent />
      <ScreenHeader
        title={headerTitle}
        showBackButton
        onBackPress={() => navigation.goBack()}
      />

      {/* Tabs */}
      {tabs.length > 1 && (
        <View style={styles.tabContainer}>
          <FlatList
            data={tabs}
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.tabList}
            keyExtractor={(_, idx) => `tab-${idx}`}
            renderItem={({ item: tab, index }) => (
              <TouchableOpacity
                style={[
                  styles.tab,
                  {
                    backgroundColor: selectedTabIndex === index ? colors.primary : colors.elevation1,
                    borderColor: selectedTabIndex === index ? colors.primary : colors.border,
                  },
                ]}
                onPress={() => handleTabPress(index)}
              >
                <Text
                  style={[
                    styles.tabName,
                    { color: selectedTabIndex === index ? '#fff' : colors.text },
                  ]}
                >
                  {tab.label}
                </Text>
                <Text
                  style={[
                    styles.tabType,
                    { color: selectedTabIndex === index ? 'rgba(255,255,255,0.7)' : colors.textMuted },
                  ]}
                >
                  {tab.typeLabel}
                </Text>
              </TouchableOpacity>
            )}
          />
        </View>
      )}

      {/* Content Grid */}
      {!currentTab || currentTab.isLoading ? (
        <View style={styles.loadingContainer}>
          <LoadingSpinner size="large" />
        </View>
      ) : currentTab.items.length === 0 ? (
        <View style={styles.emptyContainer}>
          <MaterialIcons name="movie-filter" size={48} color={colors.textMuted} />
          <Text style={[styles.emptyText, { color: colors.textMuted }]}>No content found</Text>
        </View>
      ) : (
        <FlatList
          data={currentTab.items}
          renderItem={renderGridItem}
          keyExtractor={keyExtractor}
          numColumns={NUM_COLUMNS}
          contentContainerStyle={styles.gridContent}
          columnWrapperStyle={styles.gridRow}
          showsVerticalScrollIndicator={false}
        />
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  tabContainer: {
    paddingVertical: 8,
  },
  tabList: {
    paddingHorizontal: HORIZONTAL_PADDING,
    gap: 8,
  },
  tab: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 10,
    borderWidth: 1,
    alignItems: 'center',
  },
  tabName: {
    fontSize: 14,
    fontWeight: '600',
  },
  tabType: {
    fontSize: 11,
    marginTop: 1,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    gap: 12,
  },
  emptyText: {
    fontSize: 16,
  },
  gridContent: {
    padding: HORIZONTAL_PADDING,
  },
  gridRow: {
    gap: ITEM_SPACING,
    marginBottom: ITEM_SPACING,
  },
  gridItem: {
    marginBottom: 4,
  },
  gridPoster: {
    width: '100%',
    aspectRatio: 2 / 3,
    borderRadius: 10,
    backgroundColor: 'rgba(255,255,255,0.05)',
  },
  gridTitle: {
    fontSize: 12,
    fontWeight: '500',
    marginTop: 4,
  },
  rowSection: {
    marginBottom: 24,
  },
  rowHeader: {
    flexDirection: 'row',
    alignItems: 'baseline',
    gap: 8,
    paddingHorizontal: HORIZONTAL_PADDING,
    marginBottom: 10,
  },
  rowTitle: {
    fontSize: 18,
    fontWeight: '700',
  },
  rowType: {
    fontSize: 13,
  },
  rowItem: {
    width: ROW_ITEM_WIDTH,
  },
  rowPoster: {
    width: '100%',
    aspectRatio: 2 / 3,
    borderRadius: 10,
    backgroundColor: 'rgba(255,255,255,0.05)',
  },
  rowLoadingContainer: {
    height: ROW_ITEM_WIDTH * 1.5,
    justifyContent: 'center',
    alignItems: 'center',
  },
  rowEmptyText: {
    paddingHorizontal: HORIZONTAL_PADDING,
    fontSize: 13,
  },
});

export default FolderDetailScreen;
