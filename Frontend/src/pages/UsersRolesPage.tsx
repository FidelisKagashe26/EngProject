import { SectionTitle, StatusBadge, SurfaceCard, TablePagination, GuiSelect } from "../components/ui";
import { permissionGroups, projects, rolePermissions, users } from "../data/mockData";
import { useUnsavedChanges } from "../guards/UnsavedChangesGuard";
import { useTablePagination } from "../hooks/useTablePagination";

const roles = [
  "Admin",
  "Engineer / Project Manager",
  "Accountant",
  "Store Keeper",
  "Site Supervisor",
];

export const UsersRolesPage = () => {
  const { markSaved } = useUnsavedChanges();
  const usersPagination = useTablePagination(users);
  const permissionsPagination = useTablePagination(permissionGroups);

  return (
    <div className="space-y-6">
      <SectionTitle
        subtitle="Control platform access, roles and module-level permissions."
        title="Users & Role Management"
      />

      <SurfaceCard title="Users Table">
        <div className="overflow-x-auto">
          <table className="data-table min-w-[1000px]">
            <thead>
              <tr>
                <th>S/N</th>
                <th>Name</th>
                <th>Email/Phone</th>
                <th>Role</th>
                <th>Assigned Projects</th>
                <th>Status</th>
                <th>Last Login</th>
                <th>Action</th>
              </tr>
            </thead>
            <tbody>
              {usersPagination.paginatedRows.map((user, index) => (
                <tr key={user.id}>
                  <td>{usersPagination.startIndex + index + 1}</td>
                  <td>{user.name}</td>
                  <td>
                    <p>{user.email}</p>
                    <p className="text-xs text-slate-500">{user.phone}</p>
                  </td>
                  <td>{user.role}</td>
                  <td>{user.assignedProjects}</td>
                  <td>
                    <StatusBadge status={user.status} />
                  </td>
                  <td>{user.lastLogin}</td>
                  <td>
                    <button className="btn-secondary !px-2 !py-1 text-xs">Edit</button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <TablePagination
          endIndex={usersPagination.endIndex}
          itemLabel="users"
          onPageChange={usersPagination.setPage}
          onPageSizeChange={usersPagination.setPageSize}
          page={usersPagination.page}
          pageSize={usersPagination.pageSize}
          startIndex={usersPagination.startIndex}
          totalCount={usersPagination.totalCount}
          totalPages={usersPagination.totalPages}
        />
      </SurfaceCard>

      <div className="grid grid-cols-1 gap-4 xl:grid-cols-2">
        <SurfaceCard title="Add User">
          <form className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <label className="form-field">
              <span>Full Name</span>
              <input className="input-field" placeholder="User full name" />
            </label>
            <label className="form-field">
              <span>Email</span>
              <input className="input-field" placeholder="email@company.com" type="email" />
            </label>
            <label className="form-field">
              <span>Phone</span>
              <input className="input-field" placeholder="+255 ..." />
            </label>
            <label className="form-field">
              <span>Role</span>
              <GuiSelect className="input-field">
                {roles.map((role) => (
                  <option key={`role-${role}`}>{role}</option>
                ))}
              </GuiSelect>
            </label>
            <label className="form-field sm:col-span-2">
              <span>Assign Projects</span>
              <GuiSelect className="input-field" multiple>
                {projects.map((project) => (
                  <option key={`usr-prj-${project.id}`}>{project.name}</option>
                ))}
              </GuiSelect>
            </label>
            <label className="form-field sm:col-span-2">
              <span>Permissions</span>
              <textarea
                className="input-field min-h-20"
                placeholder="Optional granular permission notes..."
              />
            </label>
            <label className="form-field">
              <span>Status</span>
              <GuiSelect className="input-field">
                <option>Active</option>
                <option>Invited</option>
                <option>Suspended</option>
              </GuiSelect>
            </label>
            <div className="sm:col-span-2 flex justify-end gap-2">
              <button className="btn-secondary" type="button">
                Cancel
              </button>
              <button className="btn-primary" onClick={markSaved} type="button">
                Save User
              </button>
            </div>
          </form>
        </SurfaceCard>

        <SurfaceCard title="Role Permission Matrix">
          <div className="overflow-x-auto">
            <table className="data-table min-w-[760px]">
              <thead>
                <tr>
                  <th>S/N</th>
                  <th>Permission Group</th>
                  {roles.map((role) => (
                    <th key={`perm-role-${role}`}>{role}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {permissionsPagination.paginatedRows.map((group, index) => (
                  <tr key={`perm-group-${group}`}>
                    <td>{permissionsPagination.startIndex + index + 1}</td>
                    <td>{group}</td>
                    {roles.map((role) => (
                      <td key={`perm-${role}-${group}`}>
                        <input
                          checked={(rolePermissions[role] ?? []).includes(group)}
                          readOnly
                          type="checkbox"
                        />
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <TablePagination
            endIndex={permissionsPagination.endIndex}
            itemLabel="permissions"
            onPageChange={permissionsPagination.setPage}
            onPageSizeChange={permissionsPagination.setPageSize}
            page={permissionsPagination.page}
            pageSize={permissionsPagination.pageSize}
            startIndex={permissionsPagination.startIndex}
            totalCount={permissionsPagination.totalCount}
            totalPages={permissionsPagination.totalPages}
          />
        </SurfaceCard>
      </div>
    </div>
  );
};


