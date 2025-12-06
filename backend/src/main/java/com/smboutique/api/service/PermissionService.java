package com.smboutique.api.service;

import com.smboutique.api.model.Permission;
import com.smboutique.api.repository.PermissionRepository;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.stereotype.Service;

import java.util.List;
import java.util.Optional;

@Service
public class PermissionService {

    @Autowired
    private PermissionRepository permissionRepository;

    public List<Permission> findAll() {
        return permissionRepository.findAll();
    }

    public Optional<Permission> findById(Long id) {
        return permissionRepository.findById(id);
    }

    public Optional<Permission> findByName(String name) {
        return permissionRepository.findByName(name);
    }

    public List<Permission> findAllByIds(Iterable<Long> ids) {
        return permissionRepository.findAllById(ids);
    }

    public Permission save(Permission permission) {
        return permissionRepository.save(permission);
    }

    public void deleteById(Long id) {
        permissionRepository.deleteById(id);
    }
}