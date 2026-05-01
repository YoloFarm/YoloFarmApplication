package com.yolofarm.yolofarm_service.repository;

import com.yolofarm.yolofarm_service.entity.User;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.Optional;

@Repository
public interface UserRepository extends JpaRepository<User, String> {
    Optional<User> findByEmail(String username);
    boolean existsByEmail(String username);
    Page<User> findAllByActiveTrue(Pageable pageable);
}
