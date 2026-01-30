/**
 * Data Grid Public API
 * Export all public components, types, and utilities
 */

// Types
export type {
  AriaAnnouncement,
  BulkOperationResult,
  CellEditEvent,
  CellPosition,
  DataRequest,
  DataResponse,
  FilterChangeEvent,
  FilterConfig,
  GridColumn,
  GridConfig,
  LoadingState,
  NavigationDirection,
  NavigationMode,
  PageChangeEvent,
  PaginationConfig,
  RealTimeUpdate,
  RowState,
  SelectionChangeEvent,
  SortChangeEvent,
  SortConfig,
} from './data-grid.types';

export { DEFAULT_GRID_CONFIG } from './data-grid.types';

// Store
export { DataGridStore } from './data-grid.store';

// Services
export { DataGridRealtimeService, type RealTimeConfig, type ConnectionState } from './data-grid-realtime.service';
export { DataGridDeepLinkService, type DeepLinkConfig, type GridUrlState } from './data-grid-deeplink.service';

// Components
export { DataGridComponent } from './data-grid.component';
export { DataGridHeaderComponent } from './data-grid-header.component';
export { DataGridBodyComponent } from './data-grid-body.component';
export { DataGridAddressCellComponent } from './data-grid-address-cell.component';
export { DataGridPaginationComponent } from './data-grid-pagination.component';
export { DataGridToolbarComponent } from './data-grid-toolbar.component';

// Pipes
export {
  ColumnLabelPipe,
  DirtyRowsDataPipe,
  OptionLabelPipe,
  SelectedRowsDataPipe,
} from './data-grid.pipes';
