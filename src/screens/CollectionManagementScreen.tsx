import React, { useState, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  StatusBar,
  Switch,
  Platform,
  Alert,
} from 'react-native';
import * as Clipboard from 'expo-clipboard';
import { useNavigation, useFocusEffect, NavigationProp } from '@react-navigation/native';
import { MaterialIcons } from '@expo/vector-icons';
import { useTheme } from '../contexts/ThemeContext';
import { useToast } from '../contexts/ToastContext';
import { Collection } from '../types/collections';
import { collectionsService } from '../services/collectionsService';
import { useCollections } from '../hooks/useCollections';
import ScreenHeader from '../components/common/ScreenHeader';
import CustomAlert from '../components/CustomAlert';
import { RootStackParamList } from '../navigation/AppNavigator';
import { useTranslation } from 'react-i18next';

const ANDROID_STATUSBAR_HEIGHT = StatusBar.currentHeight || 0;

const CollectionManagementScreen = () => {
  const { t } = useTranslation();
  const navigation = useNavigation<NavigationProp<RootStackParamList>>();
  const { currentTheme } = useTheme();
  const { showInfo, showError } = useToast();
  const { collections, refresh } = useCollections();
  const colors = currentTheme.colors;

  const [alertVisible, setAlertVisible] = useState(false);
  const [alertTitle, setAlertTitle] = useState('');
  const [alertMessage, setAlertMessage] = useState('');
  const [alertActions, setAlertActions] = useState<any[]>([]);
  const [enabledMap, setEnabledMap] = useState<Record<string, boolean>>({});

  const loadEnabledState = useCallback(async () => {
    const settings = await collectionsService.getCollectionSettings();
    setEnabledMap(settings);
  }, []);

  useFocusEffect(
    useCallback(() => {
      refresh();
      loadEnabledState();
    }, [refresh, loadEnabledState])
  );

  const handleToggleEnabled = useCallback(async (id: string, value: boolean) => {
    setEnabledMap(prev => ({ ...prev, [id]: value }));
    await collectionsService.setCollectionEnabled(id, value);
  }, []);

  const handleNewCollection = useCallback(() => {
    navigation.navigate('CollectionEditor' as any, {});
  }, [navigation]);

  const handleEdit = useCallback((id: string) => {
    navigation.navigate('CollectionEditor' as any, { collectionId: id });
  }, [navigation]);

  const handleDelete = useCallback((collection: Collection) => {
    setAlertTitle('Delete Collection');
    setAlertMessage(`Are you sure you want to delete "${collection.title}"?`);
    setAlertActions([
      { label: 'Cancel', onPress: () => setAlertVisible(false) },
      {
        label: 'Delete',
        onPress: async () => {
          setAlertVisible(false);
          await collectionsService.deleteCollection(collection.id);
        },
        style: 'destructive',
      },
    ]);
    setAlertVisible(true);
  }, []);

  const handleMoveUp = useCallback(async (id: string) => {
    await collectionsService.moveCollection(id, 'up');
  }, []);

  const handleMoveDown = useCallback(async (id: string) => {
    await collectionsService.moveCollection(id, 'down');
  }, []);

  const handleExport = useCallback(async () => {
    try {
      const json = await collectionsService.exportToJson();
      await Clipboard.setStringAsync(json);
      showInfo('Copied to clipboard');
    } catch {
      showError('Export failed');
    }
  }, [showInfo, showError]);

  const handleImport = useCallback(async () => {
    try {
      const text = await Clipboard.getStringAsync();
      if (!text?.trim()) {
        showError('Clipboard is empty');
        return;
      }
      const result = await collectionsService.importFromJson(text);
      showInfo(`Imported: ${result.added} added, ${result.updated} updated`);
    } catch {
      showError('Invalid collection data');
    }
  }, [showInfo, showError]);

  return (
    <View style={[styles.container, { backgroundColor: colors.darkBackground }]}>
      <StatusBar barStyle="light-content" backgroundColor="transparent" translucent />
      <ScreenHeader
        title="Collections"
        showBackButton
        onBackPress={() => navigation.goBack()}
      />
      <ScrollView contentContainerStyle={styles.scrollContent}>
        <TouchableOpacity
          style={[styles.newButton, { backgroundColor: colors.primary }]}
          activeOpacity={0.7}
          onPress={handleNewCollection}
        >
          <MaterialIcons name="add" size={22} color="#fff" />
          <Text style={styles.newButtonText}>New Collection</Text>
        </TouchableOpacity>

        {collections.length > 0 && (
          <View style={styles.exportImportRow}>
            <TouchableOpacity
              style={[styles.actionButton, { backgroundColor: colors.elevation3 }]}
              activeOpacity={0.7}
              onPress={handleExport}
            >
              <MaterialIcons name="file-upload" size={18} color={colors.text} />
              <Text style={[styles.actionButtonText, { color: colors.text }]}>Export</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.actionButton, { backgroundColor: colors.elevation3 }]}
              activeOpacity={0.7}
              onPress={handleImport}
            >
              <MaterialIcons name="file-download" size={18} color={colors.text} />
              <Text style={[styles.actionButtonText, { color: colors.text }]}>Import</Text>
            </TouchableOpacity>
          </View>
        )}

        {collections.length === 0 && (
          <View style={styles.emptyContainer}>
            <MaterialIcons name="folder-open" size={48} color={colors.textMuted} />
            <Text style={[styles.emptyText, { color: colors.textMuted }]}>
              No collections yet
            </Text>
            <Text style={[styles.emptySubtext, { color: colors.textMuted }]}>
              Create a collection to organize your catalogs into folders
            </Text>
          </View>
        )}

        {collections.map((collection, index) => {
          const isEnabled = enabledMap[collection.id] !== false;
          return (
            <View
              key={collection.id}
              style={[
                styles.collectionCard,
                {
                  backgroundColor: colors.elevation1,
                  borderColor: isEnabled ? colors.border : colors.border + '60',
                  opacity: isEnabled ? 1 : 0.6,
                },
              ]}
            >
              <View style={styles.cardHeader}>
                <View style={styles.cardTitleRow}>
                  <Text style={[styles.collectionTitle, { color: colors.text }]} numberOfLines={1}>
                    {collection.title}
                  </Text>
                  <Text style={[styles.folderCount, { color: colors.textMuted }]}>
                    {collection.folders.length} folder{collection.folders.length !== 1 ? 's' : ''}{!isEnabled ? ' · Hidden' : ''}
                  </Text>
                </View>
                <View style={styles.cardActions}>
                  <Switch
                    value={isEnabled}
                    onValueChange={(value) => handleToggleEnabled(collection.id, value)}
                    trackColor={{ false: colors.elevation3, true: colors.primary + '80' }}
                    thumbColor={isEnabled ? colors.primary : colors.textMuted}
                    style={styles.switch}
                  />
                  <TouchableOpacity
                    onPress={() => handleMoveUp(collection.id)}
                    disabled={index === 0}
                    style={[styles.iconButton, index === 0 && styles.disabledButton]}
                  >
                    <MaterialIcons name="arrow-upward" size={20} color={index === 0 ? colors.disabled : colors.text} />
                  </TouchableOpacity>
                  <TouchableOpacity
                    onPress={() => handleMoveDown(collection.id)}
                    disabled={index === collections.length - 1}
                    style={[styles.iconButton, index === collections.length - 1 && styles.disabledButton]}
                  >
                    <MaterialIcons name="arrow-downward" size={20} color={index === collections.length - 1 ? colors.disabled : colors.text} />
                  </TouchableOpacity>
                  <TouchableOpacity onPress={() => handleEdit(collection.id)} style={styles.iconButton}>
                    <MaterialIcons name="edit" size={20} color={colors.primary} />
                  </TouchableOpacity>
                  <TouchableOpacity onPress={() => handleDelete(collection)} style={styles.iconButton}>
                    <MaterialIcons name="delete-outline" size={20} color={colors.error} />
                  </TouchableOpacity>
                </View>
              </View>
            </View>
          );
        })}

        {collections.length === 0 && (
          <View style={styles.importOnlyRow}>
            <TouchableOpacity
              style={[styles.actionButton, { backgroundColor: colors.elevation3 }]}
              activeOpacity={0.7}
              onPress={handleImport}
            >
              <MaterialIcons name="file-download" size={18} color={colors.text} />
              <Text style={[styles.actionButtonText, { color: colors.text }]}>Import from Clipboard</Text>
            </TouchableOpacity>
          </View>
        )}
      </ScrollView>

      <CustomAlert
        visible={alertVisible}
        title={alertTitle}
        message={alertMessage}
        actions={alertActions}
        onClose={() => setAlertVisible(false)}
      />
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
  newButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 14,
    borderRadius: 12,
    marginBottom: 16,
  },
  newButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
    marginLeft: 8,
  },
  exportImportRow: {
    flexDirection: 'row',
    gap: 10,
    marginBottom: 16,
  },
  importOnlyRow: {
    marginTop: 16,
  },
  actionButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 10,
    borderRadius: 10,
    gap: 6,
  },
  actionButtonText: {
    fontSize: 14,
    fontWeight: '500',
  },
  emptyContainer: {
    alignItems: 'center',
    paddingVertical: 48,
  },
  emptyText: {
    fontSize: 18,
    fontWeight: '600',
    marginTop: 12,
  },
  emptySubtext: {
    fontSize: 14,
    marginTop: 6,
    textAlign: 'center',
    paddingHorizontal: 32,
  },
  collectionCard: {
    borderRadius: 12,
    padding: 14,
    marginBottom: 10,
    borderWidth: 1,
  },
  cardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  cardTitleRow: {
    flex: 1,
    marginRight: 8,
  },
  collectionTitle: {
    fontSize: 16,
    fontWeight: '600',
  },
  folderCount: {
    fontSize: 12,
    marginTop: 2,
  },
  cardActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  switch: {
    transform: [{ scaleX: 0.8 }, { scaleY: 0.8 }],
  },
  iconButton: {
    padding: 6,
  },
  disabledButton: {
    opacity: 0.4,
  },
});

export default CollectionManagementScreen;
