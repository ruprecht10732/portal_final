import { ChangeDetectionStrategy, Component, signal } from '@angular/core';
import { DataGridComponent } from '../../shared/components/data-grid/data-grid.component';
import type { GridColumn, GridConfig } from '../../shared/components/data-grid/data-grid.types';

@Component({
  selector: 'app-home',
  templateUrl: './app-home.component.html',
  styleUrl: './app-home.component.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [DataGridComponent],
})
export class AppHomeComponent {
  protected readonly columns = signal<GridColumn<HomeRow>[]>([
    {
      id: 'id',
      header: 'ID',
      field: 'id',
      width: '80px',
      sortable: true,
      filterable: true,
      frozen: true,
      align: 'right',
    },
    {
      id: 'name',
      header: 'Name',
      field: 'name',
      sortable: true,
      filterable: true,
      editable: true,
    },
    {
      id: 'department',
      header: 'Department',
      field: 'department',
      sortable: true,
      filterable: true,
      editable: true,
      cellType: 'select',
      selectOptions: [
        { label: 'Engineering', value: 'Engineering' },
        { label: 'Product', value: 'Product' },
        { label: 'Design', value: 'Design' },
        { label: 'Operations', value: 'Operations' },
        { label: 'People', value: 'People' },
      ],
    },
    {
      id: 'role',
      header: 'Role',
      field: 'role',
      sortable: true,
      filterable: true,
      editable: true,
    },
    {
      id: 'status',
      header: 'Status',
      field: 'status',
      sortable: true,
      filterable: true,
      editable: true,
      cellType: 'select',
      selectOptions: [
        { label: 'Active', value: 'Active' },
        { label: 'On Leave', value: 'On Leave' },
        { label: 'Inactive', value: 'Inactive' },
      ],
    },
    {
      id: 'startDate',
      header: 'Start Date',
      field: 'startDate',
      sortable: true,
      filterable: true,
      editable: true,
      cellType: 'date',
      minWidth: '140px',
    },
    {
      id: 'salary',
      header: 'Salary',
      field: 'salary',
      sortable: true,
      filterable: true,
      editable: true,
      cellType: 'number',
      align: 'right',
      minWidth: '120px',
    },
    {
      id: 'location',
      header: 'Location',
      field: 'location',
      sortable: true,
      filterable: true,
      editable: true,
    },
    {
      id: 'remote',
      header: 'Remote',
      field: 'remote',
      sortable: true,
      filterable: true,
      editable: true,
      cellType: 'boolean',
      align: 'center',
      width: '90px',
    },
  ]);

  protected readonly rows = signal<HomeRow[]>([
    {
      id: 1001,
      name: 'Avery Quinn',
      department: 'Engineering',
      role: 'Frontend Engineer',
      status: 'Active',
      startDate: '2023-02-14',
      salary: 108000,
      location: 'New York',
      remote: true,
    },
    {
      id: 1002,
      name: 'Jordan Blake',
      department: 'Product',
      role: 'Product Manager',
      status: 'Active',
      startDate: '2022-09-01',
      salary: 125000,
      location: 'Austin',
      remote: false,
    },
    {
      id: 1003,
      name: 'Maya Chen',
      department: 'Design',
      role: 'UX Designer',
      status: 'On Leave',
      startDate: '2021-05-23',
      salary: 98000,
      location: 'Seattle',
      remote: true,
    },
    {
      id: 1004,
      name: 'Leo Martinez',
      department: 'Engineering',
      role: 'Backend Engineer',
      status: 'Active',
      startDate: '2020-11-19',
      salary: 132000,
      location: 'Denver',
      remote: false,
    },
    {
      id: 1005,
      name: 'Priya Singh',
      department: 'Operations',
      role: 'Ops Lead',
      status: 'Active',
      startDate: '2019-07-08',
      salary: 115000,
      location: 'Chicago',
      remote: false,
    },
    {
      id: 1006,
      name: 'Sam Carter',
      department: 'People',
      role: 'HR Business Partner',
      status: 'Inactive',
      startDate: '2018-03-30',
      salary: 88000,
      location: 'Boston',
      remote: true,
    },
    {
      id: 1007,
      name: 'Noah Reed',
      department: 'Engineering',
      role: 'DevOps Engineer',
      status: 'Active',
      startDate: '2024-01-09',
      salary: 118000,
      location: 'San Diego',
      remote: true,
    },
    {
      id: 1008,
      name: 'Zoe Park',
      department: 'Design',
      role: 'Visual Designer',
      status: 'Active',
      startDate: '2023-06-12',
      salary: 94000,
      location: 'Portland',
      remote: false,
    },
    {
      id: 1009,
      name: 'Ethan Ross',
      department: 'Product',
      role: 'Product Analyst',
      status: 'Active',
      startDate: '2022-01-17',
      salary: 97000,
      location: 'Atlanta',
      remote: true,
    },
    {
      id: 1010,
      name: 'Lena Ortiz',
      department: 'Engineering',
      role: 'QA Engineer',
      status: 'Active',
      startDate: '2021-10-05',
      salary: 92000,
      location: 'Phoenix',
      remote: true,
    },
    {
      id: 1011,
      name: 'Riley Kim',
      department: 'Operations',
      role: 'Program Manager',
      status: 'On Leave',
      startDate: '2020-04-27',
      salary: 110000,
      location: 'Los Angeles',
      remote: false,
    },
    {
      id: 1012,
      name: 'Harper Allen',
      department: 'Engineering',
      role: 'Staff Engineer',
      status: 'Active',
      startDate: '2017-12-11',
      salary: 155000,
      location: 'San Francisco',
      remote: true,
    },
  ]);

  protected readonly gridConfig: Partial<GridConfig<HomeRow>> = {
    rowIdField: 'id',
    navigationMode: 'pagination',
    selectable: true,
    multiSelect: true,
    cardViewEnabled: true,
    cardTitleField: 'name',
    columnPickerEnabled: true,
    maxMobileColumns: 3,
  };

  protected onSaveRows(rows: HomeRow[]): void {
    this.rows.update(currentRows => {
      let nextId = this.getNextId(currentRows);
      const updated = [...currentRows];

      for (const row of rows) {
        const hasValidId = Number.isFinite(row.id);
        const rowWithId = hasValidId ? row : { ...row, id: nextId++ };
        const index = updated.findIndex(existing => existing.id === rowWithId.id);

        if (index >= 0) {
          updated[index] = rowWithId;
        } else {
          updated.unshift(rowWithId);
        }
      }

      return updated;
    });
  }

  protected onDeleteRows(rows: HomeRow[]): void {
    const idsToDelete = new Set(rows.map(row => row.id));
    this.rows.update(currentRows => currentRows.filter(row => !idsToDelete.has(row.id)));
  }

  private getNextId(rows: HomeRow[]): number {
    const maxId = rows.reduce((max, row) => Math.max(max, row.id), 0);
    return maxId + 1;
  }
}

interface HomeRow extends Record<string, unknown> {
  id: number;
  name: string;
  department: 'Engineering' | 'Product' | 'Design' | 'Operations' | 'People';
  role: string;
  status: 'Active' | 'On Leave' | 'Inactive';
  startDate: string;
  salary: number;
  location: string;
  remote: boolean;
}
