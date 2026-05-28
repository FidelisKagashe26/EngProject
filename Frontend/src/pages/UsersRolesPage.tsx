import { useEffect, useMemo, useState } from "react";
import {
  ConfirmModal,
  EmptyState,
  GuiSelect,
  SectionTitle,
  SkeletonTable,
  SurfaceCard,
  TablePagination,
} from "../components/ui";
import {
  APP_PERMISSIONS,
  APP_ROLES,
  PERMISSION_LABELS,
  ROLE_PERMISSIONS,
  type AppPermission,
  type AppRole,
  useAuth,
} from "../auth";
import { useTablePagination } from "../hooks/useTablePagination";
import {
  api,
  type ProjectApiRecord,
  type UserApiRecord,
} from "../services/api";
import { formatDate } from "../utils/format";

const ROLES = APP_ROLES;
const PERMISSION_GROUPS = APP_PERMISSIONS;
type Role = AppRole;

const splitAssignedProjects = (value: string): string[] =>
  value
    .split(",")
    .map((item) => item.trim())
    .filter(Boolean);

export const UsersRolesPage = () => {
  const { user: currentUser } = useAuth();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  const [users, setUsers] = useState<UserApiRecord[]>([]);
  const [projects, setProjects] = useState<ProjectApiRecord[]>([]);

  // Modal states
  const [showAddModal, setShowAddModal] = useState(false);
  const [editingUser, setEditingUser] = useState<UserApiRecord | null>(null);
  const [userToSuspend, setUserToSuspend] = useState<UserApiRecord | null>(null);
  const [suspending, setSuspending] = useState(false);

  // Form state
  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [role, setRole] = useState<Role>("Site Supervisor");
  const [assignedProjects, setAssignedProjects] = useState<string[]>([]);
  const [status, setStatus] = useState("Active");
  const [password, setPassword] = useState("");

  useEffect(() => {
    let mounted = true;
    const load = async () => {
      try {
        const [usersResponse, projectRows] = await Promise.all([
          api.getUsers(),
          api.getProjects(),
        ]);
        if (!mounted) return;
        setUsers(usersResponse.rows);
        setProjects(projectRows);
        setError("");
      } catch (loadError) {
        if (!mounted) return;
        setError(loadError instanceof Error ? loadError.message : "Failed to load users.");
      } finally {
        if (mounted) setLoading(false);
      }
    };
    void load();
    return () => { mounted = false; };
  }, []);

  const refreshUsers = async () => {
    const response = await api.getUsers();
    setUsers(response.rows);
  };

  const usersPagination = useTablePagination(users);
  const permissionsPagination = useTablePagination([...PERMISSION_GROUPS]);
  const projectNameById = useMemo(
    () => new Map(projects.map((project) => [project.id, project.name])),
    [projects],
  );

  const formatAssignedProjects = (value: string) => {
    const ids = splitAssignedProjects(value);
    if (ids.length === 0) return "All Projects";
    return ids.map((id) => projectNameById.get(id) ?? id).join(", ");
  };

  const resetForm = () => {
    setFullName("");
    setEmail("");
    setPhone("");
    setRole("Site Supervisor");
    setAssignedProjects([]);
    setStatus("Active");
    setPassword("");
  };

  const openAddModal = () => {
    resetForm();
    setEditingUser(null);
    setShowAddModal(true);
  };

  const openEditModal = (user: UserApiRecord) => {
    setEditingUser(user);
    setFullName(user.fullName);
    setEmail(user.email);
    setPhone(user.phone);
    setRole(user.role as Role);
    setAssignedProjects(splitAssignedProjects(user.assignedProjects));
    setStatus(user.status);
    setPassword("");
    setShowAddModal(true);
  };

  const closeModal = () => {
    setShowAddModal(false);
    setEditingUser(null);
    resetForm();
  };

  const handleSave = async () => {
    if (
      fullName.trim().length < 2 ||
      email.trim().length < 5 ||
      phone.trim().length < 7
    ) {
      setError("Please fill full name, email and phone correctly.");
      return;
    }
    if (!editingUser && password.length < 8) {
      setError("Password must be at least 8 characters for new users.");
      return;
    }

    setSaving(true);
    setError("");

    try {
      if (editingUser) {
        const payload: Parameters<typeof api.updateUser>[1] = {
          fullName: fullName.trim(),
          email: email.trim(),
          phone: phone.trim(),
          role,
          assignedProjects: assignedProjects.join(","),
          status,
        };
        if (password.length >= 8) payload.password = password;
        await api.updateUser(editingUser.id, payload);
      } else {
        await api.createUser({
          fullName: fullName.trim(),
          email: email.trim(),
          phone: phone.trim(),
          role,
          assignedProjects: assignedProjects.join(","),
          status,
          password,
        });
      }
      await refreshUsers();
      closeModal();
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : "Failed to save user.");
    } finally {
      setSaving(false);
    }
  };

  const handleSuspend = async () => {
    if (!userToSuspend) return;
    setSuspending(true);
    setError("");
    try {
      await api.suspendUser(userToSuspend.id);
      await refreshUsers();
      setUserToSuspend(null);
    } catch (suspendError) {
      setError(suspendError instanceof Error ? suspendError.message : "Failed to suspend user.");
      setUserToSuspend(null);
    } finally {
      setSuspending(false);
    }
  };

  const editingSelf = editingUser?.id === currentUser?.id;
  const modalTitle = editingUser ? `Edit User — ${editingUser.fullName}` : "Add New User";

  return (
    <div className="space-y-6">
      <SectionTitle
        subtitle="Control platform access, roles and module-level permissions."
        title="Users & Role Management"
      />

      {/* Summary cards */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <SurfaceCard title="Total Users">
          <p className="text-2xl font-bold text-slate-900">{users.length}</p>
        </SurfaceCard>
        <SurfaceCard title="Active Users">
          <p className="text-2xl font-bold text-emerald-700">
            {users.filter((u) => u.status === "Active").length}
          </p>
        </SurfaceCard>
        <SurfaceCard title="Pending / Suspended">
          <p className="text-2xl font-bold text-amber-700">
            {users.filter((u) => u.status !== "Active").length}
          </p>
        </SurfaceCard>
      </div>

      {/* Add User button - outside card, right aligned */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-end sm:gap-3">
        <button className="btn-primary whitespace-nowrap" onClick={openAddModal} type="button">
          + Add User
        </button>
      </div>

      {/* Users Table */}
      <SurfaceCard title="Users Table">
        {error && <p className="mb-4 text-sm text-red-700">{error}</p>}

        {loading ? (
          <SkeletonTable rows={4} />
        ) : users.length === 0 ? (
          <EmptyState
            description="No users found. Click Add User to create the first account."
            title="No users"
          />
        ) : (
          <>
            <div className="overflow-x-auto">
              <table className="data-table min-w-[1100px]">
                <thead>
                  <tr>
                    <th>S/N</th>
                    <th>Full Name</th>
                    <th>Email / Phone</th>
                    <th>Role</th>
                    <th>Assigned Projects</th>
                    <th>Status</th>
                    <th>Last Login</th>
                    <th>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {usersPagination.paginatedRows.map((user, index) => {
                    const isCurrentUser = currentUser?.id === user.id;

                    return (
                    <tr key={user.id}>
                      <td>{usersPagination.startIndex + index + 1}</td>
                      <td className="font-medium text-slate-900">
                        {user.fullName}
                        {isCurrentUser ? <span className="ml-2 text-xs text-slate-500">(You)</span> : null}
                      </td>
                      <td>
                        <p>{user.email}</p>
                        <p className="text-xs text-slate-500">{user.phone}</p>
                      </td>
                      <td>{user.role}</td>
                      <td className="text-xs text-slate-600">
                        {formatAssignedProjects(user.assignedProjects)}
                      </td>
                      <td>
                        <span
                          className={
                            user.status === "Active"
                              ? "text-sm font-medium text-emerald-700"
                              : user.status === "Invited"
                                ? "text-sm font-medium text-blue-700"
                                : "text-sm font-medium text-red-600"
                          }
                        >
                          {user.status}
                        </span>
                      </td>
                      <td className="text-xs text-slate-500">
                        {user.lastLogin === "Never"
                          ? "Never"
                          : formatDate(user.lastLogin)}
                      </td>
                      <td>
                        <div className="flex gap-2">
                          <button
                            className="btn-primary py-1 px-3 text-xs"
                            onClick={() => openEditModal(user)}
                            type="button"
                          >
                            Edit
                          </button>
                          {user.status !== "Suspended" && (
                            <button
                              className="btn-danger py-1 px-3 text-xs disabled:cursor-not-allowed disabled:opacity-50"
                              disabled={isCurrentUser}
                              onClick={() => setUserToSuspend(user)}
                              title={isCurrentUser ? "You cannot suspend your own account" : "Suspend user"}
                              type="button"
                            >
                              Suspend
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                    );
                  })}
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
          </>
        )}
      </SurfaceCard>

      {/* Role Permission Matrix */}
      <SurfaceCard title="Role Permission Matrix">
        <p className="mb-4 text-xs text-slate-500">
          Role access overview used by navigation, routes and protected backend modules.
        </p>
        <div className="overflow-x-auto">
          <table className="data-table min-w-[860px]">
            <thead>
              <tr>
                <th>S/N</th>
                <th>Permission Group</th>
                {ROLES.map((r) => (
                  <th key={`perm-role-${r}`} className="text-center">{r}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {permissionsPagination.paginatedRows.map((group, index) => (
                <tr key={`perm-group-${group}`}>
                  <td>{permissionsPagination.startIndex + index + 1}</td>
                  <td className="font-medium text-slate-700">
                    {PERMISSION_LABELS[group as AppPermission]}
                  </td>
                  {ROLES.map((r) => (
                    <td className="text-center" key={`perm-${r}-${group}`}>
                      {(ROLE_PERMISSIONS[r] ?? []).includes(group as AppPermission) ? (
                        <span className="text-emerald-600 font-bold">✓</span>
                      ) : (
                        <span className="text-slate-300">—</span>
                      )}
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

      {/* Add / Edit User Modal */}
      {showAddModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <SurfaceCard className="w-full max-w-2xl max-h-[90vh] overflow-y-auto" title={modalTitle}>
            <form className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <label className="form-field">
                <span>Full Name</span>
                <input
                  className="input-field"
                  onChange={(e) => setFullName(e.target.value)}
                  placeholder="User full name"
                  value={fullName}
                />
              </label>
              <label className="form-field">
                <span>Email</span>
                <input
                  className="input-field"
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="email@company.com"
                  type="email"
                  value={email}
                />
              </label>
              <label className="form-field">
                <span>Phone</span>
                <input
                  className="input-field"
                  onChange={(e) => setPhone(e.target.value)}
                  placeholder="+255 ..."
                  value={phone}
                />
              </label>
              <label className="form-field">
                <span>Role</span>
                <GuiSelect
                  className="input-field"
                  disabled={editingSelf}
                  onChange={(e) => setRole(e.target.value as Role)}
                  value={role}
                >
                  {ROLES.map((r) => (
                    <option key={`role-opt-${r}`} value={r}>{r}</option>
                  ))}
                </GuiSelect>
              </label>
              <label className="form-field">
                <span>Status</span>
                <GuiSelect
                  className="input-field"
                  disabled={editingSelf}
                  onChange={(e) => setStatus(e.target.value)}
                  value={status}
                >
                  <option value="Active">Active</option>
                  <option value="Invited">Invited</option>
                  <option value="Suspended">Suspended</option>
                </GuiSelect>
              </label>
              <label className="form-field">
                <span>
                  {editingUser ? "New Password (leave blank to keep)" : "Password"}
                </span>
                <input
                  className="input-field"
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder={editingUser ? "Leave blank to keep current" : "Min 8 characters"}
                  type="password"
                  value={password}
                />
              </label>
              <label className="form-field sm:col-span-2">
                <span>Assigned Projects (comma-separated IDs or names)</span>
                <GuiSelect
                  className="input-field"
                  multiple
                  onChange={(e) => {
                    setAssignedProjects(splitAssignedProjects(e.target.value));
                  }}
                  placeholder="All Projects"
                  value={assignedProjects}
                >
                  {projects.map((p) => (
                    <option key={`usr-prj-${p.id}`} value={p.id}>{p.name}</option>
                  ))}
                </GuiSelect>
              </label>

              {/* Role permissions preview */}
              <div className="sm:col-span-2 rounded-xl border border-slate-200 bg-slate-50 p-3">
                <p className="text-xs font-semibold uppercase tracking-wider text-slate-500 mb-2">
                  Permissions for: {role}
                </p>
                <div className="flex flex-wrap gap-2">
                  {(ROLE_PERMISSIONS[role] ?? []).map((perm) => (
                    <span
                      className="rounded-full bg-blue-50 border border-blue-200 px-2.5 py-0.5 text-xs font-medium text-blue-800"
                      key={perm}
                    >
                      {PERMISSION_LABELS[perm]}
                    </span>
                  ))}
                </div>
              </div>

              {error && <p className="sm:col-span-2 text-sm text-red-700">{error}</p>}

              <div className="sm:col-span-2 flex justify-end gap-2">
                <button className="btn-secondary" onClick={closeModal} type="button">
                  Cancel
                </button>
                <button
                  className="btn-primary"
                  disabled={saving}
                  onClick={() => void handleSave()}
                  type="button"
                >
                  {saving ? "Saving..." : editingUser ? "Update User" : "Save User"}
                </button>
              </div>
            </form>
          </SurfaceCard>
        </div>
      )}

      {/* Confirm Suspend */}
      <ConfirmModal
        cancelLabel="Cancel"
        confirmClassName="btn-danger"
        confirmLabel={suspending ? "Suspending..." : "Suspend"}
        description={
          userToSuspend
            ? `Suspend "${userToSuspend.fullName}"? They will lose access immediately. You can reactivate them by editing their account.`
            : ""
        }
        onCancel={() => setUserToSuspend(null)}
        onConfirm={() => void handleSuspend()}
        open={userToSuspend !== null}
        title="Suspend User"
      />
    </div>
  );
};
