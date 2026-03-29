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
  Modal,
  TextInput,
  ActivityIndicator,
} from 'react-native';
import * as Clipboard from 'expo-clipboard';
import * as DocumentPicker from 'expo-document-picker';
import { cacheDirectory, writeAsStringAsync, readAsStringAsync, EncodingType } from 'expo-file-system/legacy';
import * as Sharing from 'expo-sharing';
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
  const [showImportModal, setShowImportModal] = useState(false);
  const [importTab, setImportTab] = useState<'paste' | 'file' | 'url'>('paste');
  const [importText, setImportText] = useState('');
  const [importUrl, setImportUrl] = useState('');
  const [importLoading, setImportLoading] = useState(false);
  const [importPreview, setImportPreview] = useState<{ collectionCount: number; folderCount: number } | null>(null);
  const [importError, setImportError] = useState<string | null>(null);
  const [pendingJson, setPendingJson] = useState<string | null>(null);

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
      const fileUri = cacheDirectory + 'nuvio-collections.json';
      await writeAsStringAsync(fileUri, json, { encoding: EncodingType.UTF8 });
      await Sharing.shareAsync(fileUri, {
        mimeType: 'application/json',
        dialogTitle: 'Export Collections',
        UTI: 'public.json',
      });
    } catch {
      showError('Export failed');
    }
  }, [showError]);

  const resetImportState = useCallback(() => {
    setImportText('');
    setImportUrl('');
    setImportError(null);
    setImportPreview(null);
    setPendingJson(null);
    setImportLoading(false);
    setImportTab('paste');
  }, []);

  const handleOpenImport = useCallback(() => {
    resetImportState();
    setShowImportModal(true);
  }, [resetImportState]);

  const handleCloseImport = useCallback(() => {
    setShowImportModal(false);
    resetImportState();
  }, [resetImportState]);

  const validateAndPreview = useCallback((json: string) => {
    const result = collectionsService.validateCollectionsJson(json);
    if (result.valid) {
      setImportError(null);
      setImportPreview({ collectionCount: result.collectionCount, folderCount: result.folderCount });
      setPendingJson(json);
    } else {
      setImportError(result.error || 'Invalid data');
      setImportPreview(null);
      setPendingJson(null);
    }
  }, []);

  const handlePasteValidate = useCallback(async () => {
    const text = await Clipboard.getStringAsync();
    if (!text?.trim()) {
      setImportError('Clipboard is empty');
      return;
    }
    setImportText(text);
    validateAndPreview(text);
  }, [validateAndPreview]);

  const handleTextValidate = useCallback(() => {
    if (!importText.trim()) {
      setImportError('Please paste or type JSON');
      return;
    }
    validateAndPreview(importText);
  }, [importText, validateAndPreview]);

  const handleFilePick = useCallback(async () => {
    try {
      setImportLoading(true);
      setImportError(null);
      const result = await DocumentPicker.getDocumentAsync({
        type: 'application/json',
        copyToCacheDirectory: true,
      });
      if (result.canceled) {
        setImportLoading(false);
        return;
      }
      const fileUri = result.assets[0].uri;
      const content = await readAsStringAsync(fileUri, { encoding: EncodingType.UTF8 });
      setImportText(content);
      validateAndPreview(content);
    } catch {
      setImportError('Failed to read file');
    } finally {
      setImportLoading(false);
    }
  }, [validateAndPreview]);

  const handleUrlFetch = useCallback(async () => {
    if (!importUrl.trim()) {
      setImportError('Please enter a URL');
      return;
    }
    try {
      setImportLoading(true);
      setImportError(null);
      const response = await fetch(importUrl.trim());
      if (!response.ok) {
        setImportError(`Failed to fetch: HTTP ${response.status}`);
        return;
      }
      const text = await response.text();
      setImportText(text);
      validateAndPreview(text);
    } catch {
      setImportError('Failed to fetch URL');
    } finally {
      setImportLoading(false);
    }
  }, [importUrl, validateAndPreview]);

  const handleConfirmImport = useCallback(async () => {
    if (!pendingJson) return;
    try {
      const result = await collectionsService.importFromJson(pendingJson);
      showInfo(`Imported: ${result.added} added, ${result.updated} updated`);
      handleCloseImport();
    } catch {
      showError('Import failed');
    }
  }, [pendingJson, showInfo, showError, handleCloseImport]);

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
              onPress={handleOpenImport}
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
              onPress={handleOpenImport}
            >
              <MaterialIcons name="file-download" size={18} color={colors.text} />
              <Text style={[styles.actionButtonText, { color: colors.text }]}>Import</Text>
            </TouchableOpacity>
          </View>
        )}
      </ScrollView>

      {/* Import Modal */}
      <Modal visible={showImportModal} animationType="slide" transparent>
        <View style={[styles.modalOverlay, { backgroundColor: 'rgba(0,0,0,0.7)' }]}>
          <View style={[styles.importModal, { backgroundColor: colors.darkBackground }]}>
            {/* Header */}
            <View style={styles.importModalHeader}>
              <Text style={[styles.importModalTitle, { color: colors.text }]}>Import Collections</Text>
              <TouchableOpacity onPress={handleCloseImport}>
                <MaterialIcons name="close" size={24} color={colors.textMuted} />
              </TouchableOpacity>
            </View>

            {/* Tab Selector */}
            <View style={styles.importTabRow}>
              {([
                { key: 'paste' as const, label: 'Paste JSON', icon: 'content-paste' as const },
                { key: 'file' as const, label: 'Pick File', icon: 'folder-open' as const },
                { key: 'url' as const, label: 'From URL', icon: 'link' as const },
              ]).map(tab => (
                <TouchableOpacity
                  key={tab.key}
                  style={[
                    styles.importTab,
                    {
                      backgroundColor: importTab === tab.key ? colors.primary : colors.elevation1,
                      borderColor: importTab === tab.key ? colors.primary : colors.border,
                    },
                  ]}
                  onPress={() => { setImportTab(tab.key); setImportError(null); setImportPreview(null); setPendingJson(null); }}
                >
                  <MaterialIcons name={tab.icon} size={16} color={importTab === tab.key ? '#fff' : colors.textMuted} />
                  <Text style={[styles.importTabText, { color: importTab === tab.key ? '#fff' : colors.text }]}>{tab.label}</Text>
                </TouchableOpacity>
              ))}
            </View>

            <ScrollView style={styles.importModalBody} contentContainerStyle={{ paddingBottom: 20 }}>
              {/* Paste Tab */}
              {importTab === 'paste' && (
                <View>
                  <TouchableOpacity
                    style={[styles.importActionBtn, { backgroundColor: colors.elevation1, borderColor: colors.border }]}
                    onPress={handlePasteValidate}
                  >
                    <MaterialIcons name="content-paste" size={18} color={colors.primary} />
                    <Text style={[styles.importActionBtnText, { color: colors.text }]}>Paste from Clipboard</Text>
                  </TouchableOpacity>
                  <Text style={[styles.importOrText, { color: colors.textMuted }]}>or type/paste below:</Text>
                  <TextInput
                    style={[styles.importTextInput, { backgroundColor: colors.elevation1, color: colors.text, borderColor: importError ? colors.error : colors.border }]}
                    value={importText}
                    onChangeText={(text) => { setImportText(text); setImportError(null); setImportPreview(null); setPendingJson(null); }}
                    placeholder="Paste collections JSON here..."
                    placeholderTextColor={colors.disabled}
                    multiline
                    textAlignVertical="top"
                  />
                  {!importPreview && !importError && importText.trim().length > 0 && (
                    <TouchableOpacity
                      style={[styles.validateBtn, { backgroundColor: colors.elevation1, borderColor: colors.border }]}
                      onPress={handleTextValidate}
                    >
                      <Text style={[styles.validateBtnText, { color: colors.primary }]}>Validate</Text>
                    </TouchableOpacity>
                  )}
                </View>
              )}

              {/* File Tab */}
              {importTab === 'file' && (
                <TouchableOpacity
                  style={[styles.importActionBtn, { backgroundColor: colors.elevation1, borderColor: colors.border }]}
                  onPress={handleFilePick}
                  disabled={importLoading}
                >
                  {importLoading ? (
                    <ActivityIndicator size="small" color={colors.primary} />
                  ) : (
                    <MaterialIcons name="folder-open" size={18} color={colors.primary} />
                  )}
                  <Text style={[styles.importActionBtnText, { color: colors.text }]}>
                    {importLoading ? 'Reading file...' : 'Choose .json File'}
                  </Text>
                </TouchableOpacity>
              )}

              {/* URL Tab */}
              {importTab === 'url' && (
                <View>
                  <TextInput
                    style={[styles.importUrlInput, { backgroundColor: colors.elevation1, color: colors.text, borderColor: importError ? colors.error : colors.border }]}
                    value={importUrl}
                    onChangeText={(text) => { setImportUrl(text); setImportError(null); setImportPreview(null); setPendingJson(null); }}
                    placeholder="https://example.com/collections.json"
                    placeholderTextColor={colors.disabled}
                    autoCapitalize="none"
                    autoCorrect={false}
                    keyboardType="url"
                  />
                  <TouchableOpacity
                    style={[styles.importActionBtn, { backgroundColor: colors.elevation1, borderColor: colors.border, marginTop: 10 }]}
                    onPress={handleUrlFetch}
                    disabled={importLoading}
                  >
                    {importLoading ? (
                      <ActivityIndicator size="small" color={colors.primary} />
                    ) : (
                      <MaterialIcons name="download" size={18} color={colors.primary} />
                    )}
                    <Text style={[styles.importActionBtnText, { color: colors.text }]}>
                      {importLoading ? 'Fetching...' : 'Fetch & Validate'}
                    </Text>
                  </TouchableOpacity>
                </View>
              )}

              {/* Error */}
              {importError && (
                <View style={[styles.importResultBox, { backgroundColor: colors.error + '15', borderColor: colors.error }]}>
                  <MaterialIcons name="error-outline" size={18} color={colors.error} />
                  <Text style={[styles.importResultText, { color: colors.error }]}>{importError}</Text>
                </View>
              )}

              {/* Preview */}
              {importPreview && (
                <View style={[styles.importResultBox, { backgroundColor: colors.primary + '15', borderColor: colors.primary }]}>
                  <MaterialIcons name="check-circle" size={18} color={colors.primary} />
                  <Text style={[styles.importResultText, { color: colors.text }]}>
                    Valid: {importPreview.collectionCount} collection{importPreview.collectionCount !== 1 ? 's' : ''}, {importPreview.folderCount} folder{importPreview.folderCount !== 1 ? 's' : ''}
                  </Text>
                </View>
              )}
            </ScrollView>

            {/* Import Button */}
            {importPreview && pendingJson && (
              <TouchableOpacity
                style={[styles.confirmImportBtn, { backgroundColor: colors.primary }]}
                onPress={handleConfirmImport}
              >
                <MaterialIcons name="file-download" size={20} color="#fff" />
                <Text style={styles.confirmImportBtnText}>Import {importPreview.collectionCount} Collection{importPreview.collectionCount !== 1 ? 's' : ''}</Text>
              </TouchableOpacity>
            )}
          </View>
        </View>
      </Modal>

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
  modalOverlay: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  importModal: {
    width: '92%',
    maxHeight: '85%',
    borderRadius: 16,
    padding: 20,
  },
  importModalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },
  importModalTitle: {
    fontSize: 20,
    fontWeight: '700',
  },
  importTabRow: {
    flexDirection: 'row',
    gap: 8,
    marginBottom: 16,
  },
  importTab: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: 10,
    borderRadius: 10,
    borderWidth: 1,
  },
  importTabText: {
    fontSize: 12,
    fontWeight: '600',
  },
  importModalBody: {
    flexGrow: 0,
  },
  importActionBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    padding: 14,
    borderRadius: 10,
    borderWidth: 1,
  },
  importActionBtnText: {
    fontSize: 14,
    fontWeight: '500',
  },
  importOrText: {
    textAlign: 'center',
    fontSize: 12,
    marginVertical: 10,
  },
  importTextInput: {
    borderWidth: 1,
    borderRadius: 10,
    padding: 12,
    fontSize: 13,
    minHeight: 150,
    maxHeight: 250,
  },
  importUrlInput: {
    borderWidth: 1,
    borderRadius: 10,
    padding: 12,
    fontSize: 14,
  },
  validateBtn: {
    alignSelf: 'flex-start',
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 8,
    borderWidth: 1,
    marginTop: 10,
  },
  validateBtnText: {
    fontSize: 14,
    fontWeight: '600',
  },
  importResultBox: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    padding: 12,
    borderRadius: 10,
    borderWidth: 1,
    marginTop: 12,
  },
  importResultText: {
    fontSize: 13,
    flex: 1,
  },
  confirmImportBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    padding: 14,
    borderRadius: 12,
    marginTop: 12,
  },
  confirmImportBtnText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
});

export default CollectionManagementScreen;
