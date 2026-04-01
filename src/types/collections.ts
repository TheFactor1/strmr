export interface CollectionCatalogSource {
  addonId: string;
  type: string;
  catalogId: string;
}

export type FolderViewMode = 'TABBED_GRID' | 'ROWS' | 'FOLLOW_LAYOUT';

export interface CollectionFolder {
  id: string;
  title: string;
  coverImageUrl?: string;
  coverEmoji?: string;
  tileShape: 'poster' | 'wide' | 'square';
  hideTitle: boolean;
  catalogSources: CollectionCatalogSource[];
}

export interface Collection {
  id: string;
  title: string;
  backdropImageUrl?: string;
  viewMode?: FolderViewMode;
  showAllTab?: boolean;
  folders: CollectionFolder[];
}
