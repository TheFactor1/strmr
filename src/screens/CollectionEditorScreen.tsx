import React, { useState, useEffect, useCallback, useMemo } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  TextInput,
  StatusBar,
  Platform,
  Modal,
  FlatList,
  Dimensions,
} from 'react-native';
import { useNavigation, useRoute, NavigationProp } from '@react-navigation/native';
import { MaterialIcons } from '@expo/vector-icons';
import FastImage from '@d11/react-native-fast-image';
import { useTheme } from '../contexts/ThemeContext';
import { useToast } from '../contexts/ToastContext';
import { Collection, CollectionFolder, CollectionCatalogSource } from '../types/collections';
import { collectionsService } from '../services/collectionsService';
import { stremioService } from '../services/stremioService';
import ScreenHeader from '../components/common/ScreenHeader';
import CustomAlert from '../components/CustomAlert';
import { RootStackParamList } from '../navigation/AppNavigator';

const { width: screenWidth } = Dimensions.get('window');

// ─── Emoji Data ───────────────────────────────────────────
const EMOJI_CATEGORIES: { name: string; emojis: string[] }[] = [
  {
    name: 'Streaming',
    emojis: ['🎬', '🎥', '📺', '🎞️', '📽️', '🎭', '🎪', '🍿', '📡', '🔴', '▶️', '⏯️', '🎙️', '📻', '📹', '🖥️', '💿', '📀', '🎧', '🎤'],
  },
  {
    name: 'Genres',
    emojis: ['💀', '👻', '🧟', '🧛', '🦇', '🔪', '💣', '🔫', '🚀', '👽', '🤖', '🧙', '🧚', '🐉', '🦸', '🦹', '💕', '💋', '😂', '😈', '🎯', '🔥', '⚡', '🌪️', '🌊', '🏆', '🎲', '🃏'],
  },
  {
    name: 'Sports',
    emojis: ['⚽', '🏀', '🏈', '⚾', '🎾', '🏐', '🏉', '🎱', '🏓', '🏸', '🏒', '⛳', '🏹', '🥊', '🥋', '⛷️', '🏂', '🏄', '🚴', '🏊', '🤸', '🏋️', '🤺', '🏇'],
  },
  {
    name: 'Music',
    emojis: ['🎵', '🎶', '🎸', '🎹', '🥁', '🎺', '🎻', '🪕', '🎷', '🎼', '🎤', '🎧', '📯', '🪗', '🪘', '🪇'],
  },
  {
    name: 'Nature',
    emojis: ['🌍', '🌎', '🌏', '🌋', '🏔️', '🏕️', '🏖️', '🏜️', '🌅', '🌄', '🌠', '🌌', '🌈', '☀️', '🌙', '⭐', '🌸', '🌺', '🌻', '🌲', '🌴', '🍂', '❄️', '🔥'],
  },
  {
    name: 'Animals',
    emojis: ['🐶', '🐱', '🐭', '🐹', '🐰', '🦊', '🐻', '🐼', '🐨', '🐯', '🦁', '🐮', '🐷', '🐸', '🐵', '🐔', '🐧', '🐦', '🦅', '🦈', '🐙', '🦋', '🐢', '🐍', '🦎', '🐊'],
  },
  {
    name: 'Food',
    emojis: ['🍕', '🍔', '🌮', '🍣', '🍜', '🍱', '🍩', '🍪', '🎂', '🍰', '🧁', '🍫', '🍬', '🍿', '☕', '🍵', '🍷', '🍺', '🧋', '🥤', '🍹', '🧃'],
  },
  {
    name: 'Travel',
    emojis: ['✈️', '🚀', '🚂', '🚢', '🏰', '🗼', '🗽', '🏛️', '⛩️', '🕌', '🕍', '⛪', '🏠', '🏢', '🏙️', '🌃', '🌉', '🗺️', '🧭', '⛺'],
  },
  {
    name: 'People',
    emojis: ['👶', '👦', '👧', '👨', '👩', '👴', '👵', '👮', '🕵️', '👷', '👸', '🤴', '🧑‍🚀', '🧑‍🔬', '🧑‍🎨', '🧑‍🍳', '🧑‍✈️', '🧑‍🚒', '🧑‍⚕️', '🧑‍🏫', '🧑‍💻', '🤹', '💃', '🕺'],
  },
  {
    name: 'Objects',
    emojis: ['📱', '💻', '⌨️', '🖨️', '📷', '📸', '🔭', '🔬', '💡', '🔦', '🕯️', '📚', '📖', '📝', '✏️', '🖊️', '📌', '📎', '🔑', '🗝️', '🔒', '💎', '👑', '🏅'],
  },
  {
    name: 'Flags',
    emojis: [
      '🏁', '🏳️‍🌈', '🏴‍☠️',
      '🇦🇫','🇦🇱','🇩🇿','🇦🇸','🇦🇩','🇦🇴','🇦🇬','🇦🇷','🇦🇲','🇦🇺','🇦🇹','🇦🇿',
      '🇧🇸','🇧🇭','🇧🇩','🇧🇧','🇧🇾','🇧🇪','🇧🇿','🇧🇯','🇧🇹','🇧🇴','🇧🇦','🇧🇼','🇧🇷','🇧🇳','🇧🇬','🇧🇫','🇧🇮',
      '🇨🇻','🇰🇭','🇨🇲','🇨🇦','🇨🇫','🇹🇩','🇨🇱','🇨🇳','🇨🇴','🇰🇲','🇨🇬','🇨🇩','🇨🇷','🇭🇷','🇨🇺','🇨🇾','🇨🇿',
      '🇩🇰','🇩🇯','🇩🇲','🇩🇴','🇪🇨','🇪🇬','🇸🇻','🇬🇶','🇪🇷','🇪🇪','🇸🇿','🇪🇹',
      '🇫🇯','🇫🇮','🇫🇷','🇬🇦','🇬🇲','🇬🇪','🇩🇪','🇬🇭','🇬🇷','🇬🇩','🇬🇹','🇬🇳','🇬🇼','🇬🇾',
      '🇭🇹','🇭🇳','🇭🇺','🇮🇸','🇮🇳','🇮🇩','🇮🇷','🇮🇶','🇮🇪','🇮🇱','🇮🇹','🇨🇮',
      '🇯🇲','🇯🇵','🇯🇴','🇰🇿','🇰🇪','🇰🇮','🇰🇵','🇰🇷','🇰🇼','🇰🇬',
      '🇱🇦','🇱🇻','🇱🇧','🇱🇸','🇱🇷','🇱🇾','🇱🇮','🇱🇹','🇱🇺',
      '🇲🇬','🇲🇼','🇲🇾','🇲🇻','🇲🇱','🇲🇹','🇲🇭','🇲🇷','🇲🇺','🇲🇽','🇫🇲','🇲🇩','🇲🇨','🇲🇳','🇲🇪','🇲🇦','🇲🇿','🇲🇲',
      '🇳🇦','🇳🇷','🇳🇵','🇳🇱','🇳🇿','🇳🇮','🇳🇪','🇳🇬','🇲🇰','🇳🇴',
      '🇴🇲','🇵🇰','🇵🇼','🇵🇸','🇵🇦','🇵🇬','🇵🇾','🇵🇪','🇵🇭','🇵🇱','🇵🇹',
      '🇶🇦','🇷🇴','🇷🇺','🇷🇼',
      '🇰🇳','🇱🇨','🇻🇨','🇼🇸','🇸🇲','🇸🇹','🇸🇦','🇸🇳','🇷🇸','🇸🇨','🇸🇱','🇸🇬','🇸🇰','🇸🇮','🇸🇧','🇸🇴','🇿🇦','🇸🇸','🇪🇸','🇱🇰','🇸🇩','🇸🇷','🇸🇪','🇨🇭','🇸🇾',
      '🇹🇼','🇹🇯','🇹🇿','🇹🇭','🇹🇱','🇹🇬','🇹🇴','🇹🇹','🇹🇳','🇹🇷','🇹🇲','🇹🇻',
      '🇺🇬','🇺🇦','🇦🇪','🇬🇧','🇺🇸','🇺🇾','🇺🇿',
      '🇻🇺','🇻🇪','🇻🇳',
      '🇾🇪','🇿🇲','🇿🇼',
    ],
  },
  {
    name: 'Symbols',
    emojis: ['❤️', '🧡', '💛', '💚', '💙', '💜', '🖤', '🤍', '💯', '✅', '❌', '⭕', '🔴', '🟠', '🟡', '🟢', '🔵', '🟣', '⚫', '⚪', '♠️', '♥️', '♦️', '♣️', '🔔', '🔕', '💤', '🏳️'],
  },
];

// ─── Main Screen ──────────────────────────────────────────
const CollectionEditorScreen = () => {
  const navigation = useNavigation<NavigationProp<RootStackParamList>>();
  const route = useRoute();
  const { currentTheme } = useTheme();
  const { showInfo, showError } = useToast();
  const colors = currentTheme.colors;

  const collectionId = (route.params as any)?.collectionId as string | undefined;
  const isNew = !collectionId;

  const [title, setTitle] = useState('');
  const [backdropImageUrl, setBackdropImageUrl] = useState('');
  const [showAllTab, setShowAllTab] = useState(true);
  const [folders, setFolders] = useState<CollectionFolder[]>([]);
  const [editingFolder, setEditingFolder] = useState<CollectionFolder | null>(null);
  const [editingFolderIndex, setEditingFolderIndex] = useState<number>(-1);
  const [showEmojiPicker, setShowEmojiPicker] = useState(false);
  const [showCatalogPicker, setShowCatalogPicker] = useState(false);

  // Catalog picker state
  const [availableCatalogs, setAvailableCatalogs] = useState<{ addonId: string; addonName: string; type: string; catalogId: string; name: string }[]>([]);
  const [installedAddonIds, setInstalledAddonIds] = useState<Set<string>>(new Set());

  useEffect(() => {
    if (collectionId) {
      loadCollection();
    }
    loadAvailableCatalogs();
  }, [collectionId]);

  const loadCollection = async () => {
    const collections = await collectionsService.getCollections();
    const found = collections.find(c => c.id === collectionId);
    if (found) {
      setTitle(found.title);
      setBackdropImageUrl(found.backdropImageUrl || '');
      setShowAllTab(found.showAllTab !== false);
      setFolders(found.folders);
    }
  };

  const loadAvailableCatalogs = async () => {
    try {
      const addons = await stremioService.getInstalledAddonsAsync();
      const addonIds = new Set(addons.map((a: any) => a.id));
      setInstalledAddonIds(addonIds);

      const catalogs: typeof availableCatalogs = [];
      for (const addon of addons) {
        if (addon.catalogs) {
          for (const catalog of addon.catalogs) {
            catalogs.push({
              addonId: addon.id,
              addonName: addon.name,
              type: catalog.type,
              catalogId: catalog.id,
              name: catalog.name || catalog.id,
            });
          }
        }
      }
      setAvailableCatalogs(catalogs);
    } catch (error) {
      if (__DEV__) console.error('Error loading catalogs:', error);
    }
  };

  const handleSave = useCallback(async () => {
    const trimmedTitle = title.trim();
    if (!trimmedTitle) {
      showError('Please enter a collection title');
      return;
    }
    if (folders.length === 0) {
      showError('Add at least one folder');
      return;
    }

    const collection: Collection = {
      id: collectionId || collectionsService.generateId(),
      title: trimmedTitle,
      backdropImageUrl: backdropImageUrl.trim() || undefined,
      showAllTab,
      folders,
    };

    if (isNew) {
      await collectionsService.addCollection(collection);
    } else {
      await collectionsService.updateCollection(collection);
    }
    navigation.goBack();
  }, [title, backdropImageUrl, showAllTab, folders, collectionId, isNew, navigation, showError]);

  const handleAddFolder = useCallback(() => {
    const newFolder: CollectionFolder = {
      id: collectionsService.generateId(),
      title: '',
      tileShape: 'poster',
      hideTitle: false,
      catalogSources: [],
    };
    setEditingFolder(newFolder);
    setEditingFolderIndex(-1);
  }, []);

  const handleEditFolder = useCallback((index: number) => {
    setEditingFolder({ ...folders[index] });
    setEditingFolderIndex(index);
  }, [folders]);

  const handleDeleteFolder = useCallback((index: number) => {
    setFolders(prev => prev.filter((_, i) => i !== index));
  }, []);

  const handleMoveFolderUp = useCallback((index: number) => {
    if (index === 0) return;
    setFolders(prev => {
      const arr = [...prev];
      [arr[index - 1], arr[index]] = [arr[index], arr[index - 1]];
      return arr;
    });
  }, []);

  const handleMoveFolderDown = useCallback((index: number) => {
    setFolders(prev => {
      if (index >= prev.length - 1) return prev;
      const arr = [...prev];
      [arr[index], arr[index + 1]] = [arr[index + 1], arr[index]];
      return arr;
    });
  }, []);

  const handleSaveFolder = useCallback(() => {
    if (!editingFolder) return;
    if (!editingFolder.title.trim()) {
      showError('Please enter a folder title');
      return;
    }
    if (editingFolder.catalogSources.length === 0) {
      showError('Add at least one catalog');
      return;
    }

    setFolders(prev => {
      if (editingFolderIndex >= 0) {
        const arr = [...prev];
        arr[editingFolderIndex] = editingFolder;
        return arr;
      }
      return [...prev, editingFolder];
    });
    setEditingFolder(null);
    setEditingFolderIndex(-1);
  }, [editingFolder, editingFolderIndex, showError]);

  const handleSelectEmoji = useCallback((emoji: string) => {
    if (editingFolder) {
      setEditingFolder({ ...editingFolder, coverEmoji: emoji, coverImageUrl: undefined });
    }
    setShowEmojiPicker(false);
  }, [editingFolder]);

  const handleMoveCatalogSourceUp = useCallback((index: number) => {
    if (!editingFolder || index <= 0) return;
    const sources = [...editingFolder.catalogSources];
    [sources[index - 1], sources[index]] = [sources[index], sources[index - 1]];
    setEditingFolder({ ...editingFolder, catalogSources: sources });
  }, [editingFolder]);

  const handleMoveCatalogSourceDown = useCallback((index: number) => {
    if (!editingFolder || index >= editingFolder.catalogSources.length - 1) return;
    const sources = [...editingFolder.catalogSources];
    [sources[index], sources[index + 1]] = [sources[index + 1], sources[index]];
    setEditingFolder({ ...editingFolder, catalogSources: sources });
  }, [editingFolder]);

  const handleToggleCatalogSource = useCallback((source: CollectionCatalogSource) => {
    if (!editingFolder) return;
    const existing = editingFolder.catalogSources.find(
      s => s.addonId === source.addonId && s.type === source.type && s.catalogId === source.catalogId
    );
    if (existing) {
      setEditingFolder({
        ...editingFolder,
        catalogSources: editingFolder.catalogSources.filter(
          s => !(s.addonId === source.addonId && s.type === source.type && s.catalogId === source.catalogId)
        ),
      });
    } else {
      setEditingFolder({
        ...editingFolder,
        catalogSources: [...editingFolder.catalogSources, source],
      });
    }
  }, [editingFolder]);

  // ─── Folder Editor View ──────────────────────────
  if (editingFolder) {
    const missingAddons = editingFolder.catalogSources.filter(s => !installedAddonIds.has(s.addonId));

    return (
      <View style={[styles.container, { backgroundColor: colors.darkBackground }]}>
        <StatusBar barStyle="light-content" backgroundColor="transparent" translucent />
        <ScreenHeader
          title={editingFolderIndex >= 0 ? 'Edit Folder' : 'New Folder'}
          showBackButton
          onBackPress={() => { setEditingFolder(null); setEditingFolderIndex(-1); }}
        />
        <ScrollView contentContainerStyle={styles.scrollContent}>
          {/* Folder Title */}
          <Text style={[styles.label, { color: colors.textMuted }]}>Folder Title</Text>
          <TextInput
            style={[styles.textInput, { backgroundColor: colors.elevation1, color: colors.text, borderColor: colors.border }]}
            value={editingFolder.title}
            onChangeText={text => setEditingFolder({ ...editingFolder, title: text })}
            placeholder="Enter folder title"
            placeholderTextColor={colors.disabled}
            autoFocus
          />

          {/* Cover */}
          <Text style={[styles.label, { color: colors.textMuted }]}>Cover</Text>
          <View style={styles.coverRow}>
            <TouchableOpacity
              style={[styles.coverOption, { backgroundColor: colors.elevation1, borderColor: editingFolder.coverEmoji ? colors.primary : colors.border }]}
              onPress={() => setShowEmojiPicker(true)}
            >
              {editingFolder.coverEmoji ? (
                <Text style={styles.coverEmojiPreview}>{editingFolder.coverEmoji}</Text>
              ) : (
                <MaterialIcons name="emoji-emotions" size={28} color={colors.textMuted} />
              )}
              <Text style={[styles.coverOptionLabel, { color: colors.text }]}>Emoji</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[styles.coverOption, { backgroundColor: colors.elevation1, borderColor: editingFolder.coverImageUrl ? colors.primary : colors.border }]}
              onPress={() => {
                setEditingFolder({
                  ...editingFolder,
                  coverImageUrl: editingFolder.coverImageUrl || '',
                  coverEmoji: undefined,
                });
              }}
            >
              {editingFolder.coverImageUrl ? (
                <FastImage
                  source={{ uri: editingFolder.coverImageUrl }}
                  style={styles.coverImagePreview}
                  resizeMode={FastImage.resizeMode.cover}
                />
              ) : (
                <MaterialIcons name="image" size={28} color={colors.textMuted} />
              )}
              <Text style={[styles.coverOptionLabel, { color: colors.text }]}>Image URL</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[styles.coverOption, { backgroundColor: colors.elevation1, borderColor: !editingFolder.coverEmoji && !editingFolder.coverImageUrl ? colors.primary : colors.border }]}
              onPress={() => setEditingFolder({ ...editingFolder, coverEmoji: undefined, coverImageUrl: undefined })}
            >
              <MaterialIcons name="block" size={28} color={colors.textMuted} />
              <Text style={[styles.coverOptionLabel, { color: colors.text }]}>None</Text>
            </TouchableOpacity>
          </View>

          {/* Image URL input */}
          {editingFolder.coverImageUrl !== undefined && (
            <TextInput
              style={[styles.textInput, { backgroundColor: colors.elevation1, color: colors.text, borderColor: colors.border, marginTop: 8 }]}
              value={editingFolder.coverImageUrl}
              onChangeText={text => setEditingFolder({ ...editingFolder, coverImageUrl: text })}
              placeholder="Paste image URL"
              placeholderTextColor={colors.disabled}
              autoCapitalize="none"
              autoCorrect={false}
            />
          )}

          {/* Tile Shape */}
          <Text style={[styles.label, { color: colors.textMuted }]}>Tile Shape</Text>
          <View style={styles.shapeRow}>
            {(['poster', 'wide', 'square'] as const).map(shape => (
              <TouchableOpacity
                key={shape}
                style={[
                  styles.shapeButton,
                  {
                    backgroundColor: editingFolder.tileShape === shape ? colors.primary : colors.elevation1,
                    borderColor: editingFolder.tileShape === shape ? colors.primary : colors.border,
                  },
                ]}
                onPress={() => setEditingFolder({ ...editingFolder, tileShape: shape })}
              >
                <Text style={[styles.shapeButtonText, { color: editingFolder.tileShape === shape ? '#fff' : colors.text }]}>
                  {shape.charAt(0).toUpperCase() + shape.slice(1)}
                </Text>
              </TouchableOpacity>
            ))}
          </View>

          {/* Hide Title */}
          <TouchableOpacity
            style={[styles.toggleRow, { backgroundColor: colors.elevation1, borderColor: colors.border }]}
            onPress={() => setEditingFolder({ ...editingFolder, hideTitle: !editingFolder.hideTitle })}
          >
            <Text style={[styles.toggleLabel, { color: colors.text }]}>Hide Title</Text>
            <View style={[styles.toggleSwitch, { backgroundColor: editingFolder.hideTitle ? colors.primary : colors.disabled }]}>
              <View style={[styles.toggleThumb, editingFolder.hideTitle && styles.toggleThumbActive]} />
            </View>
          </TouchableOpacity>

          {/* Catalog Sources */}
          <View style={styles.catalogsHeader}>
            <Text style={[styles.label, { color: colors.textMuted }]}>Catalogs</Text>
            <TouchableOpacity onPress={() => setShowCatalogPicker(true)}>
              <MaterialIcons name="add-circle" size={24} color={colors.primary} />
            </TouchableOpacity>
          </View>

          {editingFolder.catalogSources.length === 0 && (
            <Text style={[styles.noCatalogs, { color: colors.disabled }]}>
              No catalogs added. Tap + to add catalogs from installed addons.
            </Text>
          )}

          {editingFolder.catalogSources.map((source, idx) => {
            const isMissing = !installedAddonIds.has(source.addonId);
            const catalogInfo = availableCatalogs.find(
              c => c.addonId === source.addonId && c.type === source.type && c.catalogId === source.catalogId
            );
            return (
              <View
                key={`${source.addonId}-${source.type}-${source.catalogId}`}
                style={[
                  styles.catalogSourceRow,
                  {
                    backgroundColor: colors.elevation1,
                    borderColor: isMissing ? colors.error : colors.border,
                  },
                ]}
              >
                <View style={styles.catalogSourceInfo}>
                  <Text style={[styles.catalogSourceName, { color: isMissing ? colors.error : colors.text }]} numberOfLines={1}>
                    {catalogInfo?.name || source.catalogId}
                  </Text>
                  <Text style={[styles.catalogSourceMeta, { color: isMissing ? colors.error : colors.textMuted }]}>
                    {isMissing ? `Addon not installed: ${source.addonId}` : `${source.addonId} · ${source.type}`}
                  </Text>
                </View>
                <View style={styles.catalogSourceActions}>
                  <TouchableOpacity onPress={() => handleMoveCatalogSourceUp(idx)} disabled={idx === 0} style={styles.iconBtn}>
                    <MaterialIcons name="arrow-upward" size={18} color={idx === 0 ? colors.disabled : colors.text} />
                  </TouchableOpacity>
                  <TouchableOpacity onPress={() => handleMoveCatalogSourceDown(idx)} disabled={idx === editingFolder.catalogSources.length - 1} style={styles.iconBtn}>
                    <MaterialIcons name="arrow-downward" size={18} color={idx === editingFolder.catalogSources.length - 1 ? colors.disabled : colors.text} />
                  </TouchableOpacity>
                  <TouchableOpacity
                    onPress={() => handleToggleCatalogSource(source)}
                    style={styles.removeCatalogButton}
                  >
                    <MaterialIcons name="close" size={20} color={colors.error} />
                  </TouchableOpacity>
                </View>
              </View>
            );
          })}

          {/* Save/Cancel Buttons */}
          <View style={styles.folderActions}>
            <TouchableOpacity
              style={[styles.saveButton, { backgroundColor: colors.primary }]}
              onPress={handleSaveFolder}
            >
              <Text style={styles.saveButtonText}>Save Folder</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.cancelButton, { borderColor: colors.border }]}
              onPress={() => { setEditingFolder(null); setEditingFolderIndex(-1); }}
            >
              <Text style={[styles.cancelButtonText, { color: colors.text }]}>Cancel</Text>
            </TouchableOpacity>
          </View>
        </ScrollView>

        {/* Emoji Picker Modal */}
        <Modal visible={showEmojiPicker} animationType="slide" transparent>
          <View style={[styles.modalOverlay, { backgroundColor: 'rgba(0,0,0,0.6)' }]}>
            <View style={[styles.modalContent, { backgroundColor: colors.darkBackground }]}>
              <View style={styles.modalHeader}>
                <Text style={[styles.modalTitle, { color: colors.text }]}>Select Emoji</Text>
                <TouchableOpacity onPress={() => setShowEmojiPicker(false)}>
                  <MaterialIcons name="close" size={24} color={colors.text} />
                </TouchableOpacity>
              </View>
              <ScrollView>
                {EMOJI_CATEGORIES.map(category => (
                  <View key={category.name} style={styles.emojiCategory}>
                    <Text style={[styles.emojiCategoryName, { color: colors.textMuted }]}>{category.name}</Text>
                    <View style={styles.emojiGrid}>
                      {category.emojis.map((emoji, idx) => (
                        <TouchableOpacity
                          key={`${category.name}-${idx}`}
                          style={[
                            styles.emojiButton,
                            editingFolder?.coverEmoji === emoji && { backgroundColor: colors.primary + '40', borderColor: colors.primary, borderWidth: 2 },
                          ]}
                          onPress={() => handleSelectEmoji(emoji)}
                        >
                          <Text style={styles.emojiButtonText}>{emoji}</Text>
                        </TouchableOpacity>
                      ))}
                    </View>
                  </View>
                ))}
              </ScrollView>
            </View>
          </View>
        </Modal>

        {/* Catalog Picker Modal */}
        <Modal visible={showCatalogPicker} animationType="slide" transparent>
          <View style={[styles.modalOverlay, { backgroundColor: 'rgba(0,0,0,0.6)' }]}>
            <View style={[styles.modalContent, { backgroundColor: colors.darkBackground }]}>
              <View style={styles.modalHeader}>
                <Text style={[styles.modalTitle, { color: colors.text }]}>Select Catalogs</Text>
                <TouchableOpacity onPress={() => setShowCatalogPicker(false)}>
                  <Text style={[styles.doneText, { color: colors.primary }]}>Done</Text>
                </TouchableOpacity>
              </View>
              <FlatList
                data={availableCatalogs}
                keyExtractor={(item, idx) => `${item.addonId}-${item.type}-${item.catalogId}-${idx}`}
                renderItem={({ item }) => {
                  const isSelected = editingFolder?.catalogSources.some(
                    s => s.addonId === item.addonId && s.type === item.type && s.catalogId === item.catalogId
                  );
                  return (
                    <TouchableOpacity
                      style={[
                        styles.catalogPickerItem,
                        {
                          backgroundColor: isSelected ? colors.primary + '20' : colors.elevation1,
                          borderColor: isSelected ? colors.primary : colors.border,
                        },
                      ]}
                      onPress={() => handleToggleCatalogSource({ addonId: item.addonId, type: item.type, catalogId: item.catalogId })}
                    >
                      <View style={styles.catalogPickerInfo}>
                        <Text style={[styles.catalogPickerName, { color: colors.text }]} numberOfLines={1}>
                          {item.name}
                        </Text>
                        <Text style={[styles.catalogPickerMeta, { color: colors.textMuted }]}>
                          {item.addonName} · {item.type}
                        </Text>
                      </View>
                      {isSelected && <MaterialIcons name="check-circle" size={22} color={colors.primary} />}
                    </TouchableOpacity>
                  );
                }}
              />
            </View>
          </View>
        </Modal>
      </View>
    );
  }

  // ─── Main Collection Editor View ──────────────────
  return (
    <View style={[styles.container, { backgroundColor: colors.darkBackground }]}>
      <StatusBar barStyle="light-content" backgroundColor="transparent" translucent />
      <ScreenHeader
        title={isNew ? 'New Collection' : 'Edit Collection'}
        showBackButton
        onBackPress={() => navigation.goBack()}
        rightActionComponent={
          <TouchableOpacity onPress={handleSave} style={styles.headerSaveButton}>
            <Text style={[styles.headerSaveText, { color: colors.primary }]}>Save</Text>
          </TouchableOpacity>
        }
      />
      <ScrollView contentContainerStyle={styles.scrollContent}>
        {/* Collection Title */}
        <Text style={[styles.label, { color: colors.textMuted }]}>Collection Title</Text>
        <TextInput
          style={[styles.textInput, { backgroundColor: colors.elevation1, color: colors.text, borderColor: colors.border }]}
          value={title}
          onChangeText={setTitle}
          placeholder="e.g. My Movie Channels"
          placeholderTextColor={colors.disabled}
          autoFocus={isNew}
        />

        {/* Backdrop Image URL */}
        <Text style={[styles.label, { color: colors.textMuted, marginTop: 16 }]}>Backdrop Image URL</Text>
        <TextInput
          style={[styles.textInput, { backgroundColor: colors.elevation1, color: colors.text, borderColor: colors.border }]}
          value={backdropImageUrl}
          onChangeText={setBackdropImageUrl}
          placeholder="Optional backdrop image URL"
          placeholderTextColor={colors.disabled}
          autoCapitalize="none"
          autoCorrect={false}
          keyboardType="url"
        />

        {/* Show All Tab */}
        <TouchableOpacity
          style={[styles.toggleRow, { backgroundColor: colors.elevation1, borderColor: colors.border, marginTop: 16 }]}
          onPress={() => setShowAllTab(!showAllTab)}
        >
          <Text style={[styles.toggleLabel, { color: colors.text }]}>Show "All" Tab</Text>
          <View style={[styles.toggleSwitch, { backgroundColor: showAllTab ? colors.primary : colors.disabled }]}>
            <View style={[styles.toggleThumb, showAllTab && styles.toggleThumbActive]} />
          </View>
        </TouchableOpacity>

        {/* Folders */}
        <View style={styles.foldersHeader}>
          <Text style={[styles.label, { color: colors.textMuted }]}>Folders</Text>
          <TouchableOpacity onPress={handleAddFolder}>
            <MaterialIcons name="add-circle" size={24} color={colors.primary} />
          </TouchableOpacity>
        </View>

        {folders.length === 0 && (
          <Text style={[styles.noCatalogs, { color: colors.disabled }]}>
            No folders yet. Tap + to add a folder.
          </Text>
        )}

        {folders.map((folder, index) => (
          <View
            key={folder.id}
            style={[styles.folderCard, { backgroundColor: colors.elevation1, borderColor: colors.border }]}
          >
            <View style={styles.folderCardHeader}>
              <View style={styles.folderCardLeft}>
                {folder.coverEmoji ? (
                  <Text style={styles.folderCardEmoji}>{folder.coverEmoji}</Text>
                ) : folder.coverImageUrl ? (
                  <FastImage
                    source={{ uri: folder.coverImageUrl }}
                    style={styles.folderCardImage}
                    resizeMode={FastImage.resizeMode.cover}
                  />
                ) : (
                  <MaterialIcons name="folder" size={24} color={colors.textMuted} />
                )}
                <View style={styles.folderCardInfo}>
                  <Text style={[styles.folderCardTitle, { color: colors.text }]} numberOfLines={1}>
                    {folder.title || 'Untitled'}
                  </Text>
                  <Text style={[styles.folderCardMeta, { color: colors.textMuted }]}>
                    {folder.catalogSources.length} catalog{folder.catalogSources.length !== 1 ? 's' : ''} · {folder.tileShape}
                  </Text>
                </View>
              </View>
              <View style={styles.folderCardActions}>
                <TouchableOpacity onPress={() => handleMoveFolderUp(index)} disabled={index === 0} style={styles.iconBtn}>
                  <MaterialIcons name="arrow-upward" size={18} color={index === 0 ? colors.disabled : colors.text} />
                </TouchableOpacity>
                <TouchableOpacity onPress={() => handleMoveFolderDown(index)} disabled={index === folders.length - 1} style={styles.iconBtn}>
                  <MaterialIcons name="arrow-downward" size={18} color={index === folders.length - 1 ? colors.disabled : colors.text} />
                </TouchableOpacity>
                <TouchableOpacity onPress={() => handleEditFolder(index)} style={styles.iconBtn}>
                  <MaterialIcons name="edit" size={18} color={colors.primary} />
                </TouchableOpacity>
                <TouchableOpacity onPress={() => handleDeleteFolder(index)} style={styles.iconBtn}>
                  <MaterialIcons name="delete-outline" size={18} color={colors.error} />
                </TouchableOpacity>
              </View>
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
  scrollContent: {
    padding: 16,
    paddingBottom: 40,
  },
  label: {
    fontSize: 13,
    fontWeight: '600',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginBottom: 8,
    marginTop: 16,
  },
  textInput: {
    fontSize: 16,
    padding: 14,
    borderRadius: 10,
    borderWidth: 1,
  },
  coverRow: {
    flexDirection: 'row',
    gap: 10,
  },
  coverOption: {
    flex: 1,
    aspectRatio: 1,
    borderRadius: 12,
    borderWidth: 2,
    justifyContent: 'center',
    alignItems: 'center',
    gap: 6,
  },
  coverEmojiPreview: {
    fontSize: 36,
  },
  coverImagePreview: {
    width: 40,
    height: 40,
    borderRadius: 8,
  },
  coverOptionLabel: {
    fontSize: 12,
    fontWeight: '500',
  },
  shapeRow: {
    flexDirection: 'row',
    gap: 10,
  },
  shapeButton: {
    flex: 1,
    padding: 12,
    borderRadius: 10,
    borderWidth: 1,
    alignItems: 'center',
  },
  shapeButtonText: {
    fontSize: 14,
    fontWeight: '600',
  },
  toggleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 14,
    borderRadius: 10,
    borderWidth: 1,
    marginTop: 16,
  },
  toggleLabel: {
    fontSize: 16,
    fontWeight: '500',
  },
  toggleSwitch: {
    width: 48,
    height: 28,
    borderRadius: 14,
    justifyContent: 'center',
    paddingHorizontal: 2,
  },
  toggleThumb: {
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: '#fff',
  },
  toggleThumbActive: {
    alignSelf: 'flex-end',
  },
  catalogsHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: 16,
    marginBottom: 8,
  },
  foldersHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: 16,
    marginBottom: 8,
  },
  noCatalogs: {
    fontSize: 14,
    textAlign: 'center',
    paddingVertical: 24,
  },
  catalogSourceRow: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 12,
    borderRadius: 10,
    borderWidth: 1,
    marginBottom: 8,
  },
  catalogSourceInfo: {
    flex: 1,
  },
  catalogSourceName: {
    fontSize: 15,
    fontWeight: '500',
  },
  catalogSourceMeta: {
    fontSize: 12,
    marginTop: 2,
  },
  catalogSourceActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 2,
  },
  removeCatalogButton: {
    padding: 6,
  },
  folderActions: {
    marginTop: 24,
    gap: 10,
  },
  saveButton: {
    padding: 14,
    borderRadius: 12,
    alignItems: 'center',
  },
  saveButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
  cancelButton: {
    padding: 14,
    borderRadius: 12,
    alignItems: 'center',
    borderWidth: 1,
  },
  cancelButtonText: {
    fontSize: 16,
    fontWeight: '500',
  },
  headerSaveButton: {
    padding: 8,
  },
  headerSaveText: {
    fontSize: 17,
    fontWeight: '600',
  },
  folderCard: {
    borderRadius: 12,
    padding: 12,
    marginBottom: 8,
    borderWidth: 1,
  },
  folderCardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  folderCardLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
    gap: 10,
  },
  folderCardEmoji: {
    fontSize: 24,
  },
  folderCardImage: {
    width: 32,
    height: 32,
    borderRadius: 6,
  },
  folderCardInfo: {
    flex: 1,
  },
  folderCardTitle: {
    fontSize: 15,
    fontWeight: '600',
  },
  folderCardMeta: {
    fontSize: 12,
    marginTop: 1,
  },
  folderCardActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 2,
  },
  iconBtn: {
    padding: 5,
  },
  // Modal styles
  modalOverlay: {
    flex: 1,
    justifyContent: 'flex-end',
  },
  modalContent: {
    height: '75%',
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    padding: 16,
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
    paddingTop: 4,
  },
  modalTitle: {
    fontSize: 20,
    fontWeight: '700',
  },
  doneText: {
    fontSize: 17,
    fontWeight: '600',
  },
  emojiCategory: {
    marginBottom: 20,
  },
  emojiCategoryName: {
    fontSize: 14,
    fontWeight: '600',
    marginBottom: 8,
  },
  emojiGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 4,
  },
  emojiButton: {
    width: 44,
    height: 44,
    justifyContent: 'center',
    alignItems: 'center',
    borderRadius: 10,
    borderWidth: 1,
    borderColor: 'transparent',
  },
  emojiButtonText: {
    fontSize: 26,
  },
  catalogPickerItem: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 14,
    borderRadius: 10,
    borderWidth: 1,
    marginBottom: 6,
  },
  catalogPickerInfo: {
    flex: 1,
  },
  catalogPickerName: {
    fontSize: 15,
    fontWeight: '500',
  },
  catalogPickerMeta: {
    fontSize: 12,
    marginTop: 2,
  },
});

export default CollectionEditorScreen;
