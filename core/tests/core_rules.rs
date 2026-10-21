use beacon_core::db::Database;
use beacon_core::models::UpdateNodeInput;
use beacon_core::services;
use beacon_core::state::AppState;

fn setup() -> AppState {
    let db = Database::in_memory().expect("in-memory db");
    db.migrate().expect("migrate");
    AppState { db }
}

fn seed_todo(state: &AppState) -> (String, String) {
    let group = services::groups::create(state, "测试分组".to_string(), None, None).expect("group");
    let todo = services::todos::create(
        state,
        group.id.clone(),
        "待办A".to_string(),
        None,
        Some(0),
        None,
        None,
    )
    .expect("todo");
    (group.id, todo.id)
}

/// PRD FP3.3 / 验收：拖拽排序只改 sort_order，其他属性逐字段不变。
#[test]
fn reorder_only_changes_sort_order() {
    let state = setup();
    let (_, todo_id) = seed_todo(&state);

    let n1 = services::nodes::create(&state, todo_id.clone(), "节点1".to_string(), None, None, None, None).unwrap();
    let n2 = services::nodes::create(&state, todo_id.clone(), "节点2".to_string(), None, None, None, None).unwrap();
    let n3 = services::nodes::create(&state, todo_id.clone(), "节点3".to_string(), None, None, None, None).unwrap();

    // 给节点设置丰富属性，便于逐字段比对
    services::nodes::update(
        &state,
        UpdateNodeInput {
            id: n2.id.clone(),
            title: None,
            note: Some("重要备注".to_string()),
            is_milestone: None,
            start_date: Some("2026-10-20".to_string()),
            end_date: Some("2026-10-22".to_string()),
            status: None,
        },
    )
    .unwrap();
    services::nodes::set_completed(&state, n1.id.clone(), true).unwrap();

    let before: Vec<_> = services::nodes::list(&state, todo_id.clone())
        .unwrap()
        .into_iter()
        .map(|n| (n.id.clone(), n.sort_order))
        .collect();
    assert_eq!(before.len(), 3);

    // 拖拽：n3 提到最前
    services::nodes::reorder(
        &state,
        todo_id.clone(),
        vec![n3.id.clone(), n1.id.clone(), n2.id.clone()],
    )
    .unwrap();

    let after = services::nodes::list(&state, todo_id.clone()).unwrap();
    let order: Vec<&str> = after.iter().map(|n| n.id.as_str()).collect();
    assert_eq!(order, vec![n3.id.as_str(), n1.id.as_str(), n2.id.as_str()]);

    let after_n2 = after.iter().find(|n| n.id == n2.id).unwrap();
    assert_eq!(after_n2.title, "节点2");
    assert_eq!(after_n2.note, "重要备注");
    assert_eq!(after_n2.start_date.as_deref(), Some("2026-10-20"));
    assert_eq!(after_n2.end_date.as_deref(), Some("2026-10-22"));
    assert!(!after_n2.is_milestone);

    let after_n1 = after.iter().find(|n| n.id == n1.id).unwrap();
    assert_eq!(after_n1.status, "completed");
    assert!(after_n1.completed_at.is_some(), "completed_at must survive reorder");

    // 连续拖拽 10 次：无乱序、无重复 sortOrder
    let mut ids: Vec<String> = after.iter().map(|n| n.id.clone()).collect();
    for i in 0..10 {
        ids.rotate_left(1);
        services::nodes::reorder(&state, todo_id.clone(), ids.clone()).unwrap();
        let snapshot = services::nodes::list(&state, todo_id.clone()).unwrap();
        assert_eq!(
            snapshot.iter().map(|n| n.id.clone()).collect::<Vec<_>>(),
            ids,
            "round {i} order mismatch"
        );
        let orders: Vec<i64> = snapshot.iter().map(|n| n.sort_order).collect();
        let mut sorted = orders.clone();
        sorted.sort();
        assert_eq!(orders, sorted, "sort_order must be strictly increasing");
    }
}

/// 非法 payload（数量不符 / 含非本待办节点）必须被拒绝。
#[test]
fn reorder_rejects_invalid_payload() {
    let state = setup();
    let (_, todo_id) = seed_todo(&state);
    let n1 = services::nodes::create(&state, todo_id.clone(), "节点1".to_string(), None, None, None, None).unwrap();
    let n2 = services::nodes::create(&state, todo_id.clone(), "节点2".to_string(), None, None, None, None).unwrap();

    assert!(services::nodes::reorder(&state, todo_id.clone(), vec![n1.id.clone()]).is_err());
    assert!(
        services::nodes::reorder(&state, todo_id.clone(), vec![n1.id.clone(), n2.id.clone(), "ghost".to_string()])
            .is_err()
    );
}

/// 节点全部完成 → 待办自动完成；取消任一 → 回到进行中。
#[test]
fn auto_complete_and_reopen() {
    let state = setup();
    let (_, todo_id) = seed_todo(&state);
    let n1 = services::nodes::create(&state, todo_id.clone(), "节点1".to_string(), None, None, None, None).unwrap();
    let n2 = services::nodes::create(&state, todo_id.clone(), "节点2".to_string(), None, None, None, None).unwrap();

    services::nodes::set_completed(&state, n1.id.clone(), true).unwrap();
    let todo = services::todos::list(&state, None)
        .unwrap()
        .into_iter()
        .find(|t| t.id == todo_id)
        .unwrap();
    assert_eq!(todo.status, "notStarted", "partial completion must not auto-complete");

    services::nodes::set_completed(&state, n2.id.clone(), true).unwrap();
    let todo = services::todos::list(&state, None)
        .unwrap()
        .into_iter()
        .find(|t| t.id == todo_id)
        .unwrap();
    assert_eq!(todo.status, "completed", "all nodes done must auto-complete todo");
    assert!(todo.completed_at.is_some());

    services::nodes::set_completed(&state, n2.id.clone(), false).unwrap();
    let todo = services::todos::list(&state, None)
        .unwrap()
        .into_iter()
        .find(|t| t.id == todo_id)
        .unwrap();
    assert_eq!(todo.status, "inProgress", "unchecking a node reopens the todo");
}

/// 里程碑是节点上的布尔标志：可设置、可取消，且不影响其他属性。
#[test]
fn node_milestone_flag_toggles() {
    let state = setup();
    let (_, todo_id) = seed_todo(&state);
    let node = services::nodes::create(&state, todo_id.clone(), "节点1".to_string(), None, None, None, None).unwrap();
    assert!(!node.is_milestone, "new node defaults to non-milestone");

    let marked = services::nodes::set_is_milestone(&state, node.id.clone(), true).unwrap();
    assert!(marked.is_milestone);

    // create with the flag directly
    let ms_node = services::nodes::create(
        &state,
        todo_id.clone(),
        "里程碑节点".to_string(),
        None,
        Some(true),
        None,
        None,
    )
    .unwrap();
    assert!(ms_node.is_milestone, "node can be created as milestone");

    let cleared = services::nodes::set_is_milestone(&state, node.id.clone(), false).unwrap();
    assert!(!cleared.is_milestone);

    let nodes = services::nodes::list(&state, todo_id.clone()).unwrap();
    assert_eq!(nodes.len(), 2);
    assert_eq!(nodes.iter().filter(|n| n.is_milestone).count(), 1, "only the created-as-milestone node stays flagged");
}

/// 删除分组（级联）带走待办与节点。
#[test]
fn delete_group_cascade() {
    let state = setup();
    let (group_id, todo_id) = seed_todo(&state);
    services::nodes::create(&state, todo_id.clone(), "节点1".to_string(), None, None, None, None).unwrap();

    services::groups::delete(
        &state,
        beacon_core::models::DeleteGroupInput {
            id: group_id,
            mode: "cascade".to_string(),
            target_group_id: None,
        },
    )
    .unwrap();

    assert!(services::todos::list(&state, None).unwrap().is_empty());
}

/// 删除分组（迁移）把待办搬到目标分组。
#[test]
fn delete_group_migrate() {
    let state = setup();
    let (group_id, todo_id) = seed_todo(&state);
    let other = services::groups::create(&state, "另一组".to_string(), None, None).unwrap();

    services::groups::delete(
        &state,
        beacon_core::models::DeleteGroupInput {
            id: group_id,
            mode: "migrate".to_string(),
            target_group_id: Some(other.id.clone()),
        },
    )
    .unwrap();

    let todos = services::todos::list(&state, None).unwrap();
    assert_eq!(todos.len(), 1);
    assert_eq!(todos[0].id, todo_id);
    assert_eq!(todos[0].group_id, other.id);
}

/// 导出/导入闭环。
#[test]
fn export_import_roundtrip() {
    let state = setup();
    let (_, todo_id) = seed_todo(&state);
    services::nodes::create(&state, todo_id.clone(), "节点1".to_string(), None, None, None, None).unwrap();

    let data = services::export::export(&state).unwrap();
    assert_eq!(data.todos.len(), 1);
    assert_eq!(data.nodes.len(), 1);
    assert_eq!(data.groups.len(), 2, "inbox + created group");

    let fresh = setup();
    let summary = services::export::import(&fresh, data).unwrap();
    assert_eq!(summary.todos, 1);
    assert_eq!(summary.nodes, 1);
    let nodes = services::nodes::list(&fresh, todo_id.clone()).unwrap();
    assert_eq!(nodes.len(), 1);
}

/// 备份轮转：保留最近 5 份（直接测 services::backup::rotate）。
#[test]
fn backup_rotation_keeps_five() {
    let dir = std::env::temp_dir().join(format!("beacon-rot-{}", beacon_core::models::new_id()));
    let backups = dir.join("backups");
    std::fs::create_dir_all(&backups).unwrap();
    for _ in 0..8 {
        std::fs::write(backups.join(format!("beacon-{}.db", beacon_core::models::new_id())), b"x").unwrap();
        std::thread::sleep(std::time::Duration::from_millis(20));
    }
    services::backup::rotate(&backups, 5).unwrap();
    assert_eq!(std::fs::read_dir(&backups).unwrap().count(), 5);
    std::fs::remove_dir_all(&dir).ok();
}

/// 删除待办必须幂等：重复删除不能报 "todo not found"（双击 / 重试场景）。
#[test]
fn delete_todo_is_idempotent() {
    let state = setup();
    let (_, todo_id) = seed_todo(&state);
    services::nodes::create(&state, todo_id.clone(), "节点".to_string(), None, None, None, None).unwrap();

    let closed = services::todos::delete(&state, todo_id.clone()).unwrap();
    assert!(closed.is_empty());
    assert!(services::todos::list(&state, None).unwrap().iter().all(|t| t.id != todo_id));

    // second delete: silently ok, no error
    let again = services::todos::delete(&state, todo_id.clone()).unwrap();
    assert!(again.is_empty());
}

/// 删除待办后必须从所有置顶窗口中移除；成员清空的窗口一并删除（返回给壳层关闭）。
#[test]
fn delete_todo_detaches_from_pin_windows() {
    let state = setup();
    let (_, todo_a) = seed_todo(&state);
    let (group_id, todo_b) = seed_todo(&state);

    let single = services::pin_windows::create(&state, vec![todo_a.clone()]).unwrap();
    let merged = services::pin_windows::create(&state, vec![todo_a.clone(), todo_b.clone()]).unwrap();
    assert_eq!(services::pin_windows::list(&state).unwrap().len(), 2);

    let closed = services::todos::delete(&state, todo_a.clone()).unwrap();
    assert_eq!(closed, vec![single.id.clone()], "only the single-member window closes");

    let windows = services::pin_windows::list(&state).unwrap();
    assert_eq!(windows.len(), 1);
    assert_eq!(windows[0].id, merged.id);
    assert_eq!(windows[0].members, vec![todo_b.clone()]);
    assert_eq!(windows[0].active_todo_id.as_deref(), Some(todo_b.as_str()));

    // deleting the remaining member closes the last window too
    let closed = services::todos::delete(&state, todo_b).unwrap();
    assert_eq!(closed, vec![merged.id]);
    assert!(services::pin_windows::list(&state).unwrap().is_empty());
    let _ = group_id;
}

/// 置顶待办排在每个视图最前；取消置顶后恢复原顺序。
#[test]
fn pinned_todo_sorts_first() {
    let state = setup();
    let group = services::groups::create(&state, "分组".to_string(), None, None).unwrap();
    let a = services::todos::create(&state, group.id.clone(), "A".to_string(), None, Some(2), None, None).unwrap();
    let b = services::todos::create(&state, group.id.clone(), "B".to_string(), None, Some(2), None, None).unwrap();

    let list = services::todos::list(&state, Some(group.id.clone())).unwrap();
    assert_eq!(list[0].id, a.id, "default order keeps creation order");

    services::todos::set_pinned(&state, b.id.clone(), true).unwrap();

    let grouped = services::todos::list(&state, Some(group.id.clone())).unwrap();
    assert_eq!(grouped[0].id, b.id, "pinned todo leads the group view");
    assert!(grouped[0].pinned);

    let global = services::todos::list(&state, None).unwrap();
    assert_eq!(global[0].id, b.id, "pinned todo also leads the global view");

    services::todos::set_pinned(&state, b.id.clone(), false).unwrap();
    let restored = services::todos::list(&state, Some(group.id.clone())).unwrap();
    assert_eq!(restored[0].id, a.id, "unpin restores the original order");
}
