import React, { useCallback } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, FlatList, Dimensions } from 'react-native';
import { useNavigation, NavigationProp } from '@react-navigation/native';
import FastImage from '@d11/react-native-fast-image';
import { useTheme } from '../../contexts/ThemeContext';
import { Collection, CollectionFolder } from '../../types/collections';
import { RootStackParamList } from '../../navigation/AppNavigator';

interface CollectionRowSectionProps {
  collection: Collection;
}

const { width: screenWidth } = Dimensions.get('window');

const TILE_SPACING = 10;
const LEFT_PADDING = 16;

const getTileSize = (shape: 'poster' | 'wide' | 'square') => {
  switch (shape) {
    case 'poster':
      return { width: 120, aspectRatio: 2 / 3 };
    case 'wide':
      return { width: 200, aspectRatio: 16 / 9 };
    case 'square':
      return { width: 140, aspectRatio: 1 };
  }
};

const FolderTile = React.memo(({ folder, collectionId }: { folder: CollectionFolder; collectionId: string }) => {
  const { currentTheme } = useTheme();
  const navigation = useNavigation<NavigationProp<RootStackParamList>>();
  const tileSize = getTileSize(folder.tileShape);

  const handlePress = useCallback(() => {
    navigation.navigate('FolderDetail', { collectionId, folderId: folder.id });
  }, [navigation, collectionId, folder.id]);

  const renderCover = () => {
    if (folder.coverImageUrl) {
      return (
        <FastImage
          source={{ uri: folder.coverImageUrl, priority: FastImage.priority.normal }}
          style={[styles.tileImage, { borderRadius: 12 }]}
          resizeMode={FastImage.resizeMode.cover}
        />
      );
    }

    if (folder.coverEmoji) {
      return (
        <View style={[styles.emojiCover, { backgroundColor: currentTheme.colors.elevation3 }]}>
          <Text style={styles.emojiText}>{folder.coverEmoji}</Text>
        </View>
      );
    }

    // Initials fallback
    const initials = folder.title
      .split(' ')
      .slice(0, 2)
      .map(w => w[0]?.toUpperCase() || '')
      .join('');
    return (
      <View style={[styles.initialsCover, { backgroundColor: currentTheme.colors.elevation3 }]}>
        <Text style={[styles.initialsText, { color: currentTheme.colors.text }]}>{initials}</Text>
      </View>
    );
  };

  return (
    <TouchableOpacity
      activeOpacity={0.7}
      onPress={handlePress}
      style={[styles.tileContainer, { width: tileSize.width }]}
    >
      <View style={[styles.tileImageContainer, { aspectRatio: tileSize.aspectRatio, borderRadius: 12 }]}>
        {renderCover()}
      </View>
      {!folder.hideTitle && (
        <Text
          numberOfLines={1}
          style={[styles.tileTitle, { color: currentTheme.colors.text }]}
        >
          {folder.title}
        </Text>
      )}
    </TouchableOpacity>
  );
});

const CollectionRowSection = React.memo(({ collection }: CollectionRowSectionProps) => {
  const { currentTheme } = useTheme();

  const renderFolder = useCallback(({ item }: { item: CollectionFolder }) => (
    <FolderTile folder={item} collectionId={collection.id} />
  ), [collection.id]);

  const keyExtractor = useCallback((item: CollectionFolder) => item.id, []);

  if (!collection.folders.length) return null;

  return (
    <View style={styles.container}>
      <Text style={[styles.sectionTitle, { color: currentTheme.colors.text }]}>
        {collection.title}
      </Text>
      <FlatList
        data={collection.folders}
        renderItem={renderFolder}
        keyExtractor={keyExtractor}
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.listContent}
        ItemSeparatorComponent={() => <View style={{ width: TILE_SPACING }} />}
      />
    </View>
  );
});

const styles = StyleSheet.create({
  container: {
    marginBottom: 24,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '700',
    paddingHorizontal: LEFT_PADDING,
    marginBottom: 12,
  },
  listContent: {
    paddingHorizontal: LEFT_PADDING,
  },
  tileContainer: {
    marginRight: 2,
  },
  tileImageContainer: {
    width: '100%',
    overflow: 'hidden',
    borderRadius: 12,
  },
  tileImage: {
    width: '100%',
    height: '100%',
  },
  emojiCover: {
    width: '100%',
    height: '100%',
    borderRadius: 12,
    justifyContent: 'center',
    alignItems: 'center',
  },
  emojiText: {
    fontSize: 48,
  },
  initialsCover: {
    width: '100%',
    height: '100%',
    borderRadius: 12,
    justifyContent: 'center',
    alignItems: 'center',
  },
  initialsText: {
    fontSize: 28,
    fontWeight: '700',
  },
  tileTitle: {
    fontSize: 13,
    fontWeight: '500',
    marginTop: 6,
  },
});

export default CollectionRowSection;
