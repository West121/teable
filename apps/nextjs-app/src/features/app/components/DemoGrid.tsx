import DataEditor, { GridCellKind } from '@glideapps/glide-data-grid';
import type { GridColumn, Item, DataEditorRef } from '@glideapps/glide-data-grid';
import type { IRecordSnapshot } from '@teable-group/core';
import { useCallback, useRef } from 'react';
import type { Connection } from 'sharedb/lib/client';
import '@glideapps/glide-data-grid/dist/index.css';
import { useAsyncData } from './useAsyncData';
export interface IDemoGridProps {
  tableId: string;
  columns: (GridColumn & {
    id: string;
  })[];
  connection: Connection;
}

export const DemoGrid: React.FC<IDemoGridProps> = ({ tableId, columns, connection }) => {
  const ref = useRef<DataEditorRef | null>(null);

  const getRowData = useCallback(
    async (r: Item) => {
      await new Promise((res) => setTimeout(res, 300));
      const [skip, take] = r;
      const query = connection.createSubscribeQuery<IRecordSnapshot>(tableId, {
        skip,
        take,
        limit: 1000,
      });
      const recordDocs = await new Promise<typeof query['results']>((resolve) => {
        query.on('ready', () => {
          console.log('record:ready:', query.results);
          resolve(query.results);
        });
      });
      const rowData = recordDocs.map((rd) =>
        columns.map((column) => {
          const fieldId = column.id;
          return String(rd.data.record.fields[fieldId] ?? '');
        })
      );
      console.log('getRowData', columns, rowData);
      return rowData;
    },
    [columns, connection, tableId]
  );

  const { getCellContent, onVisibleRegionChanged, onCellEdited, getCellsForSelection } =
    useAsyncData<string[]>(
      50,
      5,
      getRowData,
      useCallback(
        (rowData, col) => ({
          kind: GridCellKind.Text,
          data: rowData[col] || '',
          allowOverlay: true,
          displayData: rowData[col] || '',
        }),
        []
      ),
      useCallback((cell, newVal, rowData) => {
        const [col] = cell;
        if (newVal.kind !== GridCellKind.Text) return undefined;
        const newRow: string[] = [...rowData];
        newRow[col] = newVal.data;
        return newRow;
      }, []),
      ref
    );

  return (
    <DataEditor
      ref={ref}
      smoothScrollX
      smoothScrollY
      getCellContent={getCellContent}
      onVisibleRegionChanged={onVisibleRegionChanged}
      onCellEdited={onCellEdited}
      getCellsForSelection={getCellsForSelection}
      width={'100%'}
      columns={columns}
      rows={10000}
      rowMarkers="both"
    />
  );
};