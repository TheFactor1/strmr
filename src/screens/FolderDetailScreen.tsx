import React, { useState, useEffect, useCallback, useMemo } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  StatusBar,
  Dimensions,
  Platform,
  FlatList,
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

const FolderDetailScreen = () => {
  const navigation = useNavigation<NavigationProp<RootStackParamList>>();
  const route = useRoute();
  const { currentTheme } = useTheme();
  const colors = currentTheme.colors;

  const { collectionId, folderId } = route.params as { collectionId: string; folderId: string };

  const [folder, setFolder] = useState<CollectionFolder | null>(null);
  const [selectedTabIndex, setSelectedTabIndex] = useState(0);
  const [items, setItems] = useState<StreamingContent[]>([]);
  const [loading, setLoading] = useState(true);
  const [tabLabels, setTabLabels] = useState<{ name: string; type: string }[]>([]);

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

    // Build tab labels
    const labels = f.catalogSources.map(source => ({
      name: source.catalogId,
      type: source.type,
    }));
    setTabLabels(labels);

    // Load first tab
    if (f.catalogSources.length > 0) {
      loadCatalogData(f.catalogSources[0]);
    }
  };

  const loadCatalogData = async (source: CollectionCatalogSource) => {
    setLoading(true);
    setItems([]);
    try {
      const addons = await stremioService.getInstalledAddonsAsync();
      const addon = addons.find((a: any) => a.id === source.addonId);
      if (!addon) {
        setLoading(false);
        return;
      }

      const metas = await stremioService.getCatalog(addon, source.type, source.catalogId, 1);
      if (metas && metas.length > 0) {
        const mapped: StreamingContent[] = metas.map((meta: any) => ({
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
        setItems(mapped);
      }
    } catch (error) {
      if (__DEV__) console.error('[FolderDetail] Error loading catalog:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleTabPress = useCallback((index: number) => {
    if (!folder) return;
    setSelectedTabIndex(index);
    loadCatalogData(folder.catalogSources[index]);
  }, [folder]);

  const handleItemPress = useCallback((id: string, type: string) => {
    navigation.navigate('Metadata', { id, type });
  }, [navigation]);

  const renderItem = useCallback(({ item }: { item: StreamingContent }) => (
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

  const keyExtractor = useCallback((item: StreamingContent) => item.id, []);

  if (!folder) {
    return (
      <View style={[styles.container, { backgroundColor: colors.darkBackground }]}>
        <StatusBar barStyle="light-content" backgroundColor="transparent" translucent />
        <LoadingSpinner size="large" />
      </View>
    );
  }

  return (
    <View style={[styles.container, { backgroundColor: colors.darkBackground }]}>
      <StatusBar barStyle="light-content" backgroundColor="transparent" translucent />
      <ScreenHeader
        title={folder.title}
        showBackButton
        onBackPress={() => navigation.goBack()}
      />

      {/* Tabs */}
      {folder.catalogSources.length > 1 && (
        <View style={styles.tabContainer}>
          <FlatList
            data={tabLabels}
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
                  {tab.name}
                </Text>
                <Text
                  style={[
                    styles.tabType,
                    { color: selectedTabIndex === index ? 'rgba(255,255,255,0.7)' : colors.textMuted },
                  ]}
                >
                  {tab.type}
                </Text>
              </TouchableOpacity>
            )}
          />
        </View>
      )}

      {/* Content Grid */}
      {loading ? (
        <View style={styles.loadingContainer}>
          <LoadingSpinner size="large" />
        </View>
      ) : items.length === 0 ? (
        <View style={styles.emptyContainer}>
          <MaterialIcons name="movie-filter" size={48} color={colors.textMuted} />
          <Text style={[styles.emptyText, { color: colors.textMuted }]}>No content found</Text>
        </View>
      ) : (
        <FlatList
          data={items}
          renderItem={renderItem}
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
});

export default FolderDetailScreen;
